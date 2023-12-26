import { ChatMessage, ChatRoom } from '@/interfaces/sockets.interface';
import { RedisService } from '@/services/redis.service';
import { Socket } from 'socket.io';
import Container from 'typedi';

export class ChatRoomManager {
  private activeChatRooms: Map<string, ChatRoom>;
  private redisService: RedisService;
  private userSockets: Map<string, Socket>;

  constructor() {
    this.activeChatRooms = new Map<string, ChatRoom>();
    this.redisService = Container.get(RedisService);
    this.userSockets = new Map<string, Socket>();
  }

  public async startChat(socket: Socket, userId: string): Promise<void> {
    this.userSockets.set(userId, socket);

    await this.redisService.addUserToQueue(userId);
    const isPaired = await this.redisService.pairUsers();

    if (isPaired) {
      const otherPairedUserId = Array.from(isPaired.participants).find(id => id !== userId);

      if (otherPairedUserId) {
        const otherPairedSocket = this.userSockets.get(otherPairedUserId);
        socket.join(isPaired.id);
        otherPairedSocket?.join(isPaired.id);

        socket.to(isPaired.id).emit('chatRoom-connected', isPaired);
      }
    }
  }

  public leaveChatRoom(socket: Socket, chatRoomId: string): void {
    const room = this.activeChatRooms.get(chatRoomId);

    if (room) {
      socket.leave(chatRoomId);
      room.participants.delete(socket.id);
      room.state = 'idle';
      this.userSockets.delete(socket.id);
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
