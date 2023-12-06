import { ChatRoom } from '@/interfaces/sockets.interface';
import { Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';

export class ChatRoomManager {
  private activeChatRooms: Map<string, ChatRoom>;

  constructor() {
    this.activeChatRooms = new Map<string, ChatRoom>();
  }

  public createChatRoom(): string {
    const idleChatRooms = this.getIdleChatRooms();

    if (idleChatRooms.length > 0) {
      return idleChatRooms[0].id;
    } else {
      const chatRoomId = uuidv4();
      this.activeChatRooms.set(chatRoomId, { id: chatRoomId, state: 'idle', participants: new Set<string>() });
      return chatRoomId;
    }
  }

  public joinChatRoom(socket: Socket, chatRoomId: string): void {
    const room = this.activeChatRooms.get(chatRoomId);

    if (room && room.state === 'idle' && room.participants.size === 1) {
      socket.join(chatRoomId);
      room.participants.add(socket.id);
      room.state = 'occupied';
      console.log(`Current Rooms: ${this.activeChatRooms.size}`);
    }

    if (room && room.state === 'idle' && room.participants.size === 0) {
      socket.join(chatRoomId);
      room.participants.add(socket.id);
      console.log(`Current Rooms: ${this.activeChatRooms.size}`);
    }
  }

  public leaveChatRoom(socket: Socket, chatRoomId: string): void {
    const room = this.activeChatRooms.get(chatRoomId);

    if (room) {
      socket.leave(chatRoomId);
      room.participants.delete(socket.id);

      if (room.participants.size === 0 && room.state === 'idle') {
        this.activeChatRooms.delete(chatRoomId);
      }
    }
  }

  public getIdleChatRooms(): ChatRoom[] {
    const result: ChatRoom[] = [];
    this.activeChatRooms.forEach(chatRoom => {
      if (chatRoom.state === 'idle') {
        result.push(chatRoom);
      }
    });

    return result;
  }
}
