import { App } from '@/app';
import { ChatRoute } from '@/routes/chats.route';
import { Websocket } from '@/websocket/websocket';
import { createAdapter } from '@socket.io/redis-adapter';
import { ValidateEnv } from '@utils/validateEnv';
import { RedisClient } from './redisClient';
import { ChatSocket } from './controllers/chatSocket.controller';
import { ChatService } from './services/chat.service';
import Container from 'typedi';

ValidateEnv();

const app = new App([new ChatRoute()]);
const httpServer = app.getHttpServer();
const io = Websocket.getWebsocket(httpServer);
const redisClient = RedisClient.getInstance();
const chatService = Container.get(ChatService);

io.adapter(createAdapter(redisClient.getPubClient(), redisClient.getSubClient()));

io.initializeHandlers([
  {
    path: '/chat',
    handler: new ChatSocket(chatService, io),
  },
]);

app.listen();
