import { ChatMessage, ChatRoom } from '@/interfaces/sockets.interface';
import { RedisClient } from '@/redisClient';
import { RedisClientType } from 'redis';
import { Service } from 'typedi';
import { v4 as uuidv4 } from 'uuid';

@Service()
export class RedisService {
  private redisClient: RedisClientType;

  constructor() {
    this.redisClient = RedisClient.getInstance().getClient();
  }

  public async addUserToQueue(userId: string): Promise<void> {
    await this.redisClient.lPush('userQueue', userId);
    await this.redisClient.hSet('userStatus', userId, 'waiting');
  }

  public async pairUsers(): Promise<ChatRoom | null> {
    const user1 = await this.redisClient.rPop('userQueue');
    const user2 = await this.redisClient.rPop('userQueue');

    if (user1 && user2) {
      const chatRoomId = uuidv4();

      this.createChatRoom(chatRoomId, user1, user2);
      await this.redisClient.hSet('userStatus', user1, 'in-chat');
      await this.redisClient.hSet('userStatus', user2, 'in-chat');

      return { id: chatRoomId, state: 'occupied', participants: [user1, user2] };
    } else {
      if (user1) await this.redisClient.lPush('userQueue', user1);
      if (user2) await this.redisClient.lPush('userQueue', user2);

      return null;
    }
  }

  public async createChatRoom(roomId: string, user1: string, user2: string): Promise<void> {
    await this.redisClient.hSet('chatRooms', roomId, JSON.stringify({ state: 'occupied', participants: [user1, user2] }));
  }

  public async leaveChatRoomById(roomId: string, socketId: string): Promise<void> {
    const roomData = await this.redisClient.hGet('chatRooms', roomId);

    if (roomData) {
      const roomObj = JSON.parse(roomData) as { state: 'occupied' | 'idle'; participants: string[] };

      const socketIdIndex = roomObj.participants.indexOf(socketId);

      if (socketIdIndex > -1) {
        roomObj.participants.splice(socketIdIndex, 1);
        roomObj.state = 'idle';
        await this.redisClient.hDel('userStatus', socketId);

        const updatedRoomData = JSON.stringify(roomObj);
        await this.redisClient.hSet('chatRooms', roomId, updatedRoomData);
      }

      if (roomObj.participants.length === 0) {
        await this.redisClient.hDel('chatRooms', roomId);
      }
    }
  }

  public async checkUserSession(sessionId: string): Promise<boolean> {
    try {
      if (sessionId) {
        const userSession = await this.redisClient.hGet('userStatus', sessionId);

        return userSession ? true : false;
      } else {
        return false;
      }
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  public async getChatRoomById(chatRoomId: string): Promise<{ state: 'occupied' | 'idle'; participants: Set<string> } | undefined | null> {
    try {
      if (chatRoomId) {
        const chatRoomObj = await this.redisClient.hGet('chatRooms', chatRoomId);

        if (chatRoomObj) {
          return JSON.parse(chatRoomObj);
        }
      } else {
        return null;
      }
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  public async storeMessage(chatRoomId: string, chatMessage: ChatMessage): Promise<void> {
    try {
      if (chatRoomId && chatMessage) {
        const key = `chatRoom:${chatRoomId}:messages`;
        await this.redisClient.rPush(key, JSON.stringify(chatMessage));

        //TODO: might need to limit the number of messages
        // TODO: if chatRoom is inactive for a long time, remove the chatRoom
      }
    } catch (error) {
      console.error(error);
    }
  }

  public async deleteChatRoomMessagesById(chatRoomId: string): Promise<void> {
    try {
      if (chatRoomId) {
        const key = `chatRoom:${chatRoomId}:messages`;
        await this.redisClient.DEL(key);
      }
    } catch (error) {
      console.error(error);
    }
  }
}
