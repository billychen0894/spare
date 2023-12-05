import { ChatController } from '@/controllers/chats.controller';
import { Routes } from '@/interfaces/routes.interface';
import { Router } from 'express';

export class ChatRoute implements Routes {
  public path = '/chats';
  public router = Router();
  public chat = new ChatController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.post(`${this.path}/create-room`, this.chat.createChatRoom);
  }
}
