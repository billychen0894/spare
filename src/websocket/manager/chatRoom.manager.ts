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

    // check inactivity of chatRooms in every one hour
    setInterval(
      () => {
        this.checkInactiveChatRooms().catch(console.error);
      },
      60 * 60 * 1000,
      // 30 * 1000,
    );
  }

  public async startChat(socket: CustomSocket, userId: string, event: string, eventId: string, callback: any): Promise<void> {
    const isEventProcessed = await this.redisService.processSocketEvent(event, eventId);

    if (isEventProcessed) return;

    if (socket.sessionId && !this.userSockets.has(socket.sessionId)) {
      this.userSockets.set(userId, socket);
    }

    // Check user session if it's already existed in Redis
    if (socket.sessionId && socket.chatRoomId) {
      const userStatus = await this.redisService.checkUserStatus(socket.sessionId);
      const chatRoom = await this.redisService.getChatRoomById(socket.chatRoomId);

      if (chatRoom) {
        const participants = Array.from(chatRoom.participants);
        const isUserInRoom = participants.includes(socket.sessionId);

        if (userStatus === 'in-chat' && isUserInRoom) {
          const otherPairedUserId = participants.find(id => id !== socket.sessionId);

          socket.join(socket.chatRoomId);

          if (otherPairedUserId) {
            // Get the other user socket in order to emit chatRoom connected event to the other user that has session
            const otherPairedUserSocket = this.userSockets.get(otherPairedUserId);

            otherPairedUserSocket
              ?.to(socket.chatRoomId)
              .emit('chatRoom-created', { id: socket.chatRoomId, state: chatRoom.state, participants: chatRoom.participants });
          }

          callback();
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

        socket.to(isPaired.id).emit('chatRoom-created', isPaired);
        otherPairedSocket?.to(isPaired.id).emit('chatRoom-created', isPaired);
      }
    }
    callback();
  }

  public async leaveChatRoom(socket: CustomSocket, chatRoomId: string, callback: any): Promise<void> {
    if (chatRoomId) {
      const socketId = socket.sessionId ? socket.sessionId : socket.id;

      socket.to(chatRoomId).emit('left-chat', socketId);
      socket.leave(chatRoomId);
      this.userSockets.delete(socketId);

      const userKey = `user:${socketId}:lastActivity`;
      const chatRoomKey = `chatRoom:${chatRoomId}:lastActivity`;
      await this.redisService.removeUserMessageIds(socketId, chatRoomId);
      await this.redisService.leaveChatRoomById(chatRoomId, socketId);
      await this.redisService.deleteChatRoomMessagesById(chatRoomId);
      await this.redisService.deleteLastActiveTime(userKey, socketId);
      await this.redisService.deleteLastActiveTime(chatRoomKey, socketId);
    }

    callback();
  }

  public sendMessage(socket: CustomSocket, event: string): void {
    socket.on(event, async (chatRoomId: string, chatMessage: ChatMessage, eventId, callback: any) => {
      try {
        const isEventProcessed = await this.redisService.processSocketEvent(event, eventId);

        if (isEventProcessed) return;

        socket.to(chatRoomId).emit('receive-message', chatMessage);

        // store messages to Redis
        await this.redisService.storeMessage(chatRoomId, chatMessage);
        callback();
      } catch (error) {
        console.error(error);
      }
    });
  }

  public retrieveChatMessages(socket: CustomSocket, event: string): void {
    socket.on(event, async (chatRoomId: string, eventId, callback: any) => {
      try {
        const isEventProcessed = await this.redisService.processSocketEvent(event, eventId);

        if (isEventProcessed) return;

        // Retrieve chat messages from Redis
        const chatMessages = await this.redisService.retrieveMessages(chatRoomId);

        if (chatMessages) {
          const socketUserId = socket.sessionId ? socket.sessionId : socket.id;
          const originalSocket = this.userSockets.get(socketUserId);

          // use original socket to broadcast event to chatRoom as the socket itself needs to be notified in order to get chat history
          originalSocket?.to(chatRoomId).emit('chat-history', chatMessages);
        }

        callback();
      } catch (error) {
        console.error(error);
      }
    });
  }

  public disconnect(socket: CustomSocket, event: string): void {
    socket.on(event, async () => {
      try {
        const socketId = socket.sessionId ? socket.sessionId : socket.id;

        if (socketId) {
          const userStatus = await this.redisService.checkUserStatus(socketId);

          if (userStatus === 'waiting') {
            await this.redisService.removeUserFromQueue(socketId);
          }

          if (userStatus === 'in-chat') {
            const lastActiveTime = new Date().toISOString();
            await this.redisService.setLastActiveTimeBySocketId(socketId, lastActiveTime);
          }
        }
      } catch (error) {
        console.error(error);
      }
    });
  }

  public async checkInactiveChatRooms(): Promise<void> {
    try {
      const chatRooms = await this.redisService.getAllChatRooms();

      if (chatRooms && chatRooms?.length > 0) {
        for (const chatRoom of chatRooms) {
          const thresholdInSeconds = 2 * 24 * 60 * 60; // two days;
          // const thresholdInSeconds = 30; // 30 sec;
          const isInactive = await this.redisService.isInactive(`chatRoom:${chatRoom?.id}:lastActivity`, thresholdInSeconds);

          if (isInactive) {
            // Broadcast to chatroom about inactivity and the chat room is removed
            const user1Socket = this.userSockets.get(chatRoom.participants[0]);
            const user2Socket = this.userSockets.get(chatRoom.participants[1]);

            if (user1Socket) {
              user1Socket.to(chatRoom?.id).emit('inactive-chatRoom', chatRoom);

              const socketId = user1Socket.sessionId ? user1Socket.sessionId : user1Socket.id;
              const chatRoomId = chatRoom.id;
              const userKey = `user:${socketId}:lastActivity`;
              const chatRoomKey = `chatRoom:${chatRoomId}:lastActivity`;
              await this.redisService.removeUserMessageIds(socketId, chatRoomId);
              await this.redisService.leaveChatRoomById(chatRoomId, socketId);
              await this.redisService.deleteChatRoomMessagesById(chatRoomId);
              await this.redisService.deleteLastActiveTime(userKey, socketId);
              await this.redisService.deleteLastActiveTime(chatRoomKey, socketId);
            }

            if (user2Socket) {
              user2Socket.to(chatRoom?.id).emit('inactive-chatRoom', chatRoom);

              const socketId = user2Socket.sessionId ? user2Socket.sessionId : user2Socket.id;
              const chatRoomId = chatRoom.id;
              const userKey = `user:${socketId}:lastActivity`;
              const chatRoomKey = `chatRoom:${chatRoomId}:lastActivity`;
              await this.redisService.removeUserMessageIds(socketId, chatRoomId);
              await this.redisService.leaveChatRoomById(chatRoomId, socketId);
              await this.redisService.deleteChatRoomMessagesById(chatRoomId);
              await this.redisService.deleteLastActiveTime(userKey, socketId);
              await this.redisService.deleteLastActiveTime(chatRoomKey, socketId);
            }
          }
        }
      }
    } catch (error) {
      console.error(error);
    }
  }

  public checkChatRoomSession(socket: CustomSocket, event: string): void {
    socket.on(event, async (chatRoomId: string, sessionId: string, eventId: string, callback: any) => {
      try {
        const isEventProcessed = await this.redisService.processSocketEvent(event, eventId);

        if (isEventProcessed) return;

        const chatRoom = await this.redisService.getChatRoomById(chatRoomId);

        if (chatRoom && chatRoom.participants.includes(sessionId)) {
          socket.emit('receive-chatRoom-session', chatRoom);
          callback();
        } else {
          socket.emit('receive-chatRoom-session', null);
          callback();
        }
      } catch (error) {
        console.error(error);
      }
    });
  }
}
