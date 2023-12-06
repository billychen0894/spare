import { ChatRoomManager } from '@/websocket/manager/chatRoom.manager';
import { Socket } from 'socket.io';
import { Service } from 'typedi';

@Service()
export class ChatService {
  private chatRoomManager: ChatRoomManager;

  constructor() {
    this.chatRoomManager = new ChatRoomManager();
  }

  public createChatRoomId(): string {
    return this.chatRoomManager.createChatRoom();
  }

  public joinChatRoom(socket: Socket, event: string): void {
    socket.on(event, (chatRoomId: string) => {
      this.chatRoomManager.joinChatRoom(socket, chatRoomId);
    });
  }
}
