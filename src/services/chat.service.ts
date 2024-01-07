import { CustomSocket } from '@/interfaces/sockets.interface';
import { ChatRoomManager } from '@/websocket/manager/chatRoom.manager';
import { Service } from 'typedi';

@Service()
export class ChatService {
  private chatRoomManager: ChatRoomManager;

  constructor() {
    this.chatRoomManager = new ChatRoomManager();
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
}
