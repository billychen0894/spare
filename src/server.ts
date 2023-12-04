import { App } from '@/app';
import { ValidateEnv } from '@utils/validateEnv';
import { ChatSocket } from '@websocket/chat.socket';
import { Websocket } from '@websocket/websocket';

ValidateEnv();

const app = new App([]);

const httpServer = app.getHttpServer();
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const io = Websocket.getWebsocket(httpServer);

io.initializeHandlers([
  {
    path: '/chat',
    handler: new ChatSocket(),
  },
]);

app.listen();
