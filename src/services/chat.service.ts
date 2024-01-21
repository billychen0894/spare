import { HTTPException } from '@/exceptions/HttpException';
import { ChatRoom, CustomSocket } from '@/interfaces/sockets.interface';
import { RedisService } from '@/services/redis.service';
import { ChatRoomManager } from '@/websocket/manager/chatRoom.manager';
import { Websocket } from '@/websocket/websocket';
import Container, { Service } from 'typedi';

@Service()
export class ChatService {
  private chatRoomManager: ChatRoomManager | null = null;
  private redisService: RedisService;

  constructor() {
    this.redisService = Container.get(RedisService);
  }

  private getChatRoomManager(): ChatRoomManager {
    if (!this.chatRoomManager) {
      const io = Websocket.io;
      if (!io) {
        throw new Error('Socket.io instance is not initialized yet');
      }
      this.chatRoomManager = new ChatRoomManager(io);
    }
    return this.chatRoomManager;
  }

  public async findChatRoomById(chatRoomId: string): Promise<ChatRoom> {
    const chatRoom = await this.redisService.getChatRoomById(chatRoomId);
    if (!chatRoom) throw new HTTPException(409, "Chat room doesn't exist");

    return chatRoom;
  }

  public startChat(socket: CustomSocket, event: string): void {
    socket.on(event, (userId, eventId, callback: any) => {
      this.getChatRoomManager().startChat(socket, userId, event, eventId, callback);
    });
  }

  public leaveChatRoom(socket: CustomSocket, event: string): void {
    socket.on(event, (chatRoomId: string, callback: any) => {
      this.getChatRoomManager().leaveChatRoom(socket, chatRoomId, callback);
    });
  }

  public sendMessage(socket: CustomSocket, event: string): void {
    return this.getChatRoomManager().sendMessage(socket, event);
  }

  public retrieveChatMessages(socket: CustomSocket, event: string): void {
    return this.getChatRoomManager().retrieveChatMessages(socket, event);
  }

  public disconnect(socket: CustomSocket, event: string): void {
    return this.getChatRoomManager().disconnect(socket, event);
  }

  public checkChatRoomSession(socket: CustomSocket, event: string): void {
    return this.getChatRoomManager().checkChatRoomSession(socket, event);
  }
}
