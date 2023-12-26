import { ChatService } from '@/services/chat.service';
import Container from 'typedi';

export class ChatController {
  public chat = Container.get(ChatService);
}
