import { ORIGIN } from '@/config';
import { SocketInterface } from '@/interfaces/sockets.interface';
import { Server, Socket } from 'socket.io';

export class Websocket extends Server {
  private static io: Websocket;

  constructor(httpServer: any) {
    super(httpServer, {
      cors: {
        origin: ORIGIN,
        methods: ['POST', 'GET'],
      },
    });
  }

  public static getWebsocket(httpServer?: any): Websocket {
    if (!Websocket.io) {
      Websocket.io = new Websocket(httpServer);
    }

    return Websocket.io;
  }

  public initializeHandlers(socketHandlers: Array<{ path: string; handler: SocketInterface }>) {
    socketHandlers.forEach(element => {
      const namespace = Websocket.io.of(element.path, (socket: Socket) => {
        element.handler.handleConnection(socket);
      });

      if (element.handler.middlewareImplementation) {
        namespace.use(element.handler.middlewareImplementation);
      }
    });
  }
}
