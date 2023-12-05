import { App } from '@/app';
import { ChatRoute } from '@/routes/chats.route';
import { ValidateEnv } from '@utils/validateEnv';
import { ChatSocket } from '@websocket/chat.socket';
import { Websocket } from '@websocket/websocket';

ValidateEnv();

const app = new App([new ChatRoute()]);

const httpServer = app.getHttpServer();
const io = Websocket.getWebsocket(httpServer);

io.initializeHandlers([
  {
    path: '/chat',
    handler: new ChatSocket(),
  },
]);

app.listen();
