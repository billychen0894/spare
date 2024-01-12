import { HTTPException } from '@/exceptions/HttpException';
import { ChatRoom, CustomSocket } from '@/interfaces/sockets.interface';
import { RedisService } from '@/services/redis.service';
import { ChatRoomManager } from '@/websocket/manager/chatRoom.manager';
import Container, { Service } from 'typedi';

@Service()
export class ChatService {
  private chatRoomManager: ChatRoomManager;
  private redisService: RedisService;

  constructor() {
    this.chatRoomManager = new ChatRoomManager();
    this.redisService = Container.get(RedisService);
  }

  public async findChatRoomById(chatRoomId: string): Promise<ChatRoom> {
    const chatRoom = await this.redisService.getChatRoomById(chatRoomId);
    if (!chatRoom) throw new HTTPException(409, "Chat room doesn't exist");

    return chatRoom;
  }

  public startChat(socket: CustomSocket, event: string): void {
    socket.on(event, (userId, eventId, callback: any) => {
      this.chatRoomManager.startChat(socket, userId, event, eventId, callback);
    });
  }

  public leaveChatRoom(socket: CustomSocket, event: string): void {
    socket.on(event, (chatRoomId: string, callback: any) => {
      this.chatRoomManager.leaveChatRoom(socket, chatRoomId, callback);
    });
  }

  public sendMessage(socket: CustomSocket, event: string): void {
    return this.chatRoomManager.sendMessage(socket, event);
  }

  public retrieveChatMessages(socket: CustomSocket, event: string): void {
    return this.chatRoomManager.retrieveChatMessages(socket, event);
  }

  public disconnect(socket: CustomSocket, event: string): void {
    return this.chatRoomManager.disconnect(socket, event);
  }

  public checkChatRoomSession(socket: CustomSocket, event: string): void {
    return this.chatRoomManager.checkChatRoomSession(socket, event);
  }
}
