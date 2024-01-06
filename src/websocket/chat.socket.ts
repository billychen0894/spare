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

  public handleConnection(socket: CustomSocket): void {
    socket.emit('session', { sessionId: socket.sessionId, chatRoomId: socket.chatRoomId });

    this.chatService.sendMessage(socket, 'send-message');
    this.chatService.leaveChatRoom(socket, 'leave-chat');
    this.chatService.startChat(socket, 'start-chat');
    this.chatService.retrieveChatMessages(socket, 'retrieve-chat-messages');
  }

  public async middlewareImplementation(socket: CustomSocket, next: any): Promise<void> {
    console.log(`New connection: ${socket.id}`);

    // Socket Session Persistent Implementation
    const sessionId = socket.handshake.auth.sessionId as string | undefined;
    const chatRoomId = socket.handshake.auth.chatRoomId as string | undefined;

    if (sessionId && chatRoomId) {
      const hasUserSession = await this.redisService.checkUserSession(sessionId);

      if (hasUserSession) {
        socket.sessionId = sessionId;
        socket.chatRoomId = chatRoomId;
        return next();
      }
    }

    // // If no session Id, assign socket.id as sessionId
    socket.sessionId = socket.id;
    next();
  }
}
