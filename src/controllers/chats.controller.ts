import { ChatService } from '@/services/chat.service';
import { NextFunction, Request, Response } from 'express';
import Container from 'typedi';

export class ChatController {
  public chat = Container.get(ChatService);

  public createChatRoom = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const chatRoom = this.chat.createChatRoom();
      res.status(200).json({ chatRoom });
    } catch (error) {
      next(error);
    }
  };
}
