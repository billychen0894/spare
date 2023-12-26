import { ChatRoomManager } from '@/websocket/manager/chatRoom.manager';
import { Socket } from 'socket.io';
import { Service } from 'typedi';

@Service()
export class ChatService {
  private chatRoomManager: ChatRoomManager;

  constructor() {
    this.chatRoomManager = new ChatRoomManager();
  }

  public startChat(socket: Socket, event: string): void {
    socket.on(event, userId => {
      this.chatRoomManager.startChat(socket, userId);
    });
  }

  public leaveChatRoom(socket: Socket, event: string): void {
    socket.on(event, (chatRoomId: string) => {
      this.chatRoomManager.leaveChatRoom(socket, chatRoomId);
    });
  }

  public initMessagingToChatRoom(socket: Socket, event: string) {
    return this.chatRoomManager.onMessageToChatRoom(socket, event);
  }

  public onChatRoomConnected(socket: Socket, event: string) {
    return this.chatRoomManager.onChatRoomConnected(socket, event);
  }
}
