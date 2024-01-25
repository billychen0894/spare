import { CustomSocket, SocketInterface } from '@/interfaces/sockets.interface';
import { ChatService } from '@/services/chat.service';
import { RedisService } from '@/services/redis.service';
import Container from 'typedi';

export class ChatSocket implements SocketInterface {
  private chatService: ChatService;
  private redisService: RedisService;

  constructor() {
    this.redisService = Container.get(RedisService);
    this.chatService = Container.get(ChatService);
  }

  public async handleConnection(socket: CustomSocket): Promise<void> {
    socket.emit('session', { sessionId: socket.sessionId, chatRoomId: socket.chatRoomId });

    this.chatService.sendMessage(socket, 'send-message');
    this.chatService.leaveChatRoom(socket, 'leave-chat');
    this.chatService.startChat(socket, 'start-chat');
    this.chatService.retrieveChatMessages(socket, 'retrieve-chat-messages');
    this.chatService.disconnect(socket, 'disconnect');
    this.chatService.checkChatRoomSession(socket, 'check-chatRoom-session');

    // socket.onAny((eventName, ...args) => {
    //   console.log(eventName); // 'hello'
    //   console.log(args); // [ 1, '2', { 3: '4', 5: ArrayBuffer (1) [ 6 ] } ]
    // });

    if (!socket.recovered) {
      try {
        if (socket?.sessionId && socket?.chatRoomId) {
          const chatRoom = await this.redisService.getChatRoomById(socket?.chatRoomId);
          if (chatRoom && chatRoom.state === 'occupied') {
            // get last active time
            const lastActiveTime = await this.redisService.getLastActiveTimeBySocketId(socket?.sessionId);
            const missedMessages = await this.redisService.getMissedMessages(socket?.chatRoomId, lastActiveTime);
            socket.emit('session', { sessionId: socket.sessionId, chatRoomId: socket.chatRoomId });

            if (missedMessages) {
              socket.to(socket?.chatRoomId).emit('missed-messages', missedMessages);
            }
          }
        }
      } catch (error) {
        console.error(error);
      }
    }
  }

  public async middlewareImplementation(socket: CustomSocket, next: any): Promise<void> {
    console.log(`New connection: ${socket.id}`);

    // Socket Session Persistent Implementation
    const sessionId = socket.handshake.auth.sessionId as string | undefined;
    const chatRoomId = socket.handshake.auth.chatRoomId as string | undefined;

    if (sessionId && chatRoomId) {
      const hasUserSession = await this.redisService.checkUserStatus(sessionId);

      if (hasUserSession) {
        socket.sessionId = sessionId;
        socket.chatRoomId = chatRoomId;
        await this.redisService.storeUserSessionId(sessionId);
        return next();
      }
    }

    // // If no session Id, assign socket.id as sessionId
    socket.sessionId = socket.id;
    await this.redisService.storeUserSessionId(socket.id);
    next();
  }
}
