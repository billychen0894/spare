import { SocketInterface } from '@/interfaces/sockets.interface';
import { ChatService } from '@/services/chat.service';
import { Socket } from 'socket.io';
import { DefaultEventsMap } from 'socket.io/dist/typed-events';
import Container from 'typedi';

export class ChatSocket implements SocketInterface {
  private chatService: ChatService;

  constructor() {
    this.chatService = Container.get(ChatService);
  }

  public handleConnection(socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>): void {
    socket.on('connection', socket => {
      console.log(`Socket ${socket.id} is connected...`);
    });
    this.chatService.initMessagingToChatRoom(socket, 'chat-message');
    this.chatService.leaveChatRoom(socket, 'leave-chat');
    this.chatService.onChatRoomConnected(socket, 'chatRoom-connected');
    this.chatService.startChat(socket, 'start-chat');
  }

  public middlewareImplementation(socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>, next: any): void {
    console.log(`New connection: ${socket.id}`);
    next();
  }
}

// Dynamic generation of rooms when there's socket instances
// rooms should be created if existing rooms are occupied with socket instances
// each room should can only have 2 socket instances

// Keep tracking all occupied rooms and idel rooms
