import { ChatMessage, CustomSocket } from '@/interfaces/sockets.interface';
import { RedisService } from '@/services/redis.service';
import { Socket } from 'socket.io';
import Container from 'typedi';

export class ChatRoomManager {
  private redisService: RedisService;
  private userSockets: Map<string, CustomSocket>;

  constructor() {
    this.redisService = Container.get(RedisService);
    this.userSockets = new Map<string, Socket>();
  }

  public async startChat(socket: CustomSocket, userId: string): Promise<void> {
    if (socket.sessionId && !this.userSockets.has(socket.sessionId)) {
      this.userSockets.set(userId, socket);
    }

    // Check user session if it's already existed in Redis
    if (socket.sessionId && socket.chatRoomId) {
      const hasUserSession = await this.redisService.checkUserSession(socket.sessionId);
      const chatRoom = await this.redisService.getChatRoomById(socket.chatRoomId);

      if (chatRoom) {
        const participants = Array.from(chatRoom.participants);
        const isUserInRoom = participants.includes(socket.sessionId);

        if (hasUserSession && isUserInRoom) {
          const otherPairedUserId = participants.find(id => id !== socket.sessionId);

          socket.join(socket.chatRoomId);

          if (otherPairedUserId) {
            // Get the other user socket in order to emit chatRoom connected event to the other user that has session
            const otherPairedUserSocket = this.userSockets.get(otherPairedUserId);

            otherPairedUserSocket
              ?.to(socket.chatRoomId)
              .emit('chatRoom-connected', { id: socket.chatRoomId, state: chatRoom.state, participants: chatRoom.participants });
          }

          return;
        }
      }
    }

    await this.redisService.addUserToQueue(userId);
    const isPaired = await this.redisService.pairUsers();

    if (isPaired) {
      const otherPairedUserId = Array.from(isPaired.participants).find(id => id !== userId);

      // If it's paired, update chatRoomId in session obj
      socket.emit('session', { sessionId: socket.sessionId, chatRoomId: isPaired.id });

      if (otherPairedUserId) {
        const otherPairedSocket = this.userSockets.get(otherPairedUserId);

        socket.join(isPaired.id);
        otherPairedSocket?.join(isPaired.id);
        otherPairedSocket?.emit('session', { sessionId: otherPairedSocket.sessionId, chatRoomId: isPaired.id });

        socket.to(isPaired.id).emit('chatRoom-connected', isPaired);
        otherPairedSocket?.to(isPaired.id).emit('chatRoom-connected', isPaired);
      }
    }
  }

  public async leaveChatRoom(socket: CustomSocket, chatRoomId: string): Promise<void> {
    if (chatRoomId) {
      const socketId = socket.sessionId ? socket.sessionId : socket.id;
      await this.redisService.leaveChatRoomById(chatRoomId, socketId);
      await this.redisService.deleteChatRoomMessagesById(chatRoomId);
      await this.redisService.deleteLastActiveTimeBySocketId(socketId);

      socket.to(chatRoomId).emit('left-chat', 'Someone has left the chat');
      socket.leave(chatRoomId);
      this.userSockets.delete(socketId);
    }
  }

  public sendMessage(socket: CustomSocket, event: string): void {
    socket.on(event, async (chatRoomId: string, chatMessage: ChatMessage) => {
      socket.to(chatRoomId).emit('receive-message', chatMessage);

      // store messages to Redis
      await this.redisService.storeMessage(chatRoomId, chatMessage);
    });
  }

  public retrieveChatMessages(socket: CustomSocket, event: string): void {
    socket.on(event, async (chatRoomId: string) => {
      // Retrieve chat messages from Redis
      const chatMessages = await this.redisService.retrieveMessages(chatRoomId);

      if (chatMessages) {
        const socketUserId = socket.sessionId ? socket.sessionId : socket.id;
        const originalSocket = this.userSockets.get(socketUserId);

        if (originalSocket) {
          // use original socket to broadcast event to chatRoom as the socket itself needs to be notified in order to get chat history
          originalSocket.to(chatRoomId).emit('chat-history', chatMessages);
        }
      }
    });
  }

  public disconnect(socket: CustomSocket, event: string): void {
    socket.on(event, async () => {
      try {
        const socketId = socket.sessionId ? socket.sessionId : socket.id;
        const lastActiveTime = new Date().toISOString();

        await this.redisService.setLastActiveTimeBySocketId(socketId, lastActiveTime);
      } catch (error) {
        console.error(error);
      }
    });
  }
}
