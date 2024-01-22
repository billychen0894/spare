import { App } from '@/app';
import { ChatRoute } from '@/routes/chats.route';
import { ChatSocket } from '@/websocket/chat.socket';
import { Websocket } from '@/websocket/websocket';
import { createAdapter } from '@socket.io/redis-adapter';
import { ValidateEnv } from '@utils/validateEnv';
import { RedisClient } from './redisClient';

ValidateEnv();

const app = new App([new ChatRoute()]);
const httpServer = app.getHttpServer();
const io = Websocket.getWebsocket(httpServer);
const redisClient = RedisClient.getInstance();

io.adapter(createAdapter(redisClient.getPubClient(), redisClient.getSubClient()));

io.initializeHandlers([
  {
    path: '/chat',
    handler: new ChatSocket(),
  },
]);

app.listen();
