import { ChatMessage, ChatRoom } from '@/interfaces/sockets.interface';
import { Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';

export class ChatRoomManager {
  private activeChatRooms: Map<string, ChatRoom>;

  constructor() {
    this.activeChatRooms = new Map<string, ChatRoom>();
  }

  public createChatRoom(): ChatRoom {
    const idleChatRooms = this.getIdleChatRooms();

    if (idleChatRooms.length > 0) {
      return idleChatRooms[0];
    } else {
      const chatRoomId = uuidv4();
      this.activeChatRooms.set(chatRoomId, { id: chatRoomId, state: 'idle', participants: new Set<string>() });
      return { id: chatRoomId, state: 'idle', participants: new Set<string>() };
    }
  }

  public joinChatRoom(socket: Socket, chatRoom: ChatRoom): void {
    const room = this.activeChatRooms.get(chatRoom.id);

    if (room && room.state === 'idle' && room.participants.size === 1) {
      socket.join(chatRoom.id);
      room.participants.add(socket.id);
      room.state = 'occupied';
      socket.to(room.id).emit('chatRoom-connected', { id: room.id, state: room.state, participants: Array.from(room.participants) });
    }

    if (room && room.state === 'idle' && room.participants.size === 0) {
      socket.join(chatRoom.id);
      room.participants.add(socket.id);
    }
  }

  public leaveChatRoom(socket: Socket, chatRoomId: string): void {
    const room = this.activeChatRooms.get(chatRoomId);

    if (room) {
      socket.leave(chatRoomId);
      room.participants.delete(socket.id);
      room.state = 'idle';
      socket.to(room.id).emit('left-chat', 'Someone has left the chat');

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
        messageObj.timestamp = Date.now();

        socket.to(Array.from(socket.rooms)[1]).emit(event, messageObj);
      }
    });
  }

  public onChatRoomConnected(socket: Socket, event: string): void {
    socket.on(event, (chatRoom: ChatRoom) => {
      socket.to(chatRoom.id).emit('chatRoom-connected', chatRoom);
    });
  }
}
