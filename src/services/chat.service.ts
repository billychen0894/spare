import { Service } from 'typedi';
import { v4 as uuidv4 } from 'uuid';

@Service()
export class ChatService {
  public createChatRoomId() {
    return uuidv4();
  }
}
