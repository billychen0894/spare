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
    socket.on(event, userId => {
      this.chatRoomManager.startChat(socket, userId);
    });
  }

  public leaveChatRoom(socket: CustomSocket, event: string): void {
    socket.on(event, (chatRoomId: string) => {
      this.chatRoomManager.leaveChatRoom(socket, chatRoomId);
    });
  }

  public initMessagingToChatRoom(socket: CustomSocket, event: string) {
    return this.chatRoomManager.onMessageToChatRoom(socket, event);
  }
}
