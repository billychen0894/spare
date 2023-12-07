import { ChatMessage, ChatRoom } from '@/interfaces/sockets.interface';
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
      console.log(`Socket in rooms: ${Array.from(socket.rooms)}`);
    }

    if (room && room.state === 'idle' && room.participants.size === 0) {
      socket.join(chatRoomId);
      room.participants.add(socket.id);
      console.log(`Current Rooms: ${this.activeChatRooms.size}`);
      console.log(`Socket in rooms: ${Array.from(socket.rooms)}`);
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

  public onMessageToChatRoom(socket: Socket, event: string): void {
    socket.on(event, (messageObj: ChatMessage) => {
      // 0 index is the roomId that is automatically assigned by Socket.io, roomId is its socket.id
      // 1 index is the roomId that is explictly assigned
      if (socket.rooms.size === 2) {
        const chatRoomId: string = Array.from(socket.rooms)[1];
        const currChatRoom = this.activeChatRooms.get(chatRoomId)!;
        const participants: string[] = Array.from(currChatRoom?.participants);

        messageObj.receiver = socket.id !== participants[0] ? participants[0] : participants[1];

        socket.to(Array.from(socket.rooms)[1]).emit(event, messageObj);
      }
    });
  }
}
