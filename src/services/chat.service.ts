import { ChatRoom } from '@/interfaces/sockets.interface';
import { ChatRoomManager } from '@/websocket/manager/chatRoom.manager';
import { Socket } from 'socket.io';
import { Service } from 'typedi';

@Service()
export class ChatService {
  private chatRoomManager: ChatRoomManager;

  constructor() {
    this.chatRoomManager = new ChatRoomManager();
  }

  public createChatRoom(): ChatRoom {
    return this.chatRoomManager.createChatRoom();
  }

  public joinChatRoom(socket: Socket, event: string): void {
    socket.on(event, (chatRoom: ChatRoom) => {
      this.chatRoomManager.joinChatRoom(socket, chatRoom);
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
