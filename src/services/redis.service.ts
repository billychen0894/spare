import { ChatRoom } from '@/interfaces/sockets.interface';
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

      return { id: chatRoomId, state: 'occupied', participants: new Set([user1, user2]) };
    } else {
      if (user1) await this.redisClient.lPush('userQueue', user1);
      if (user2) await this.redisClient.lPush('userQueue', user2);

      return null;
    }
  }

  public async createChatRoom(roomId: string, user1: string, user2: string): Promise<void> {
    await this.redisClient.hSet('chatRooms', roomId, JSON.stringify({ state: 'occupied', participants: [user1, user2] }));
  }
}