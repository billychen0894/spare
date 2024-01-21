import { SOCKET_ORIGIN } from '@/config';
import { SocketInterface } from '@/interfaces/sockets.interface';
import { createAdapter } from '@socket.io/cluster-adapter';
import { Server, Socket } from 'socket.io';

export class Websocket extends Server {
  public static io: Websocket;

  constructor(httpServer: any) {
    super(httpServer, {
      cors: {
        origin: SOCKET_ORIGIN,
        methods: ['POST', 'GET'],
      },
      connectionStateRecovery: {},
      // set up the adapter on each worker thread
      adapter: createAdapter(),
    });

    Websocket.io = this;
  }

  public initializeHandlers(socketHandlers: Array<{ path: string; handler: SocketInterface }>) {
    socketHandlers.forEach(element => {
      const namespace = this.of(element.path, (socket: Socket) => {
        element.handler.handleConnection.bind(element.handler)(socket);
      });

      if (element.handler.middlewareImplementation) {
        namespace.use(element.handler.middlewareImplementation.bind(element.handler));
      }
    });
  }
}
