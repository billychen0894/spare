import { SocketInterface } from '@/interfaces/sockets.interface';
import { Socket } from 'socket.io';
import { DefaultEventsMap } from 'socket.io/dist/typed-events';

export class ChatSocket implements SocketInterface {
  handleConnection(socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>): void {
    socket.on('message', msg => {
      socket.broadcast.emit('message', msg);
    });
  }
}
