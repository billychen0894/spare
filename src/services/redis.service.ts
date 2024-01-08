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

  public async removeUserFromQueue(userId: string): Promise<void> {
    await this.redisClient.lRem('userQueue', 0, userId);
    await this.redisClient.hDel('userStatus', userId);
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

  public async checkUserStatus(sessionId: string): Promise<string | null> {
    try {
      if (sessionId) {
        const userStatus = await this.redisClient.hGet('userStatus', sessionId);

        return userStatus ? userStatus : null;
      } else {
        return null;
      }
    } catch (error) {
      console.error(error);
      return null;
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
        const isMessageExisted = await this.redisClient.sIsMember('chatMessageIds', chatMessage?.id);

        if (!isMessageExisted) {
          const key = `chatRoom:${chatRoomId}:messages`;
          await this.redisClient.sAdd('chatMessageIds', chatMessage?.id);
          await this.redisClient.rPush(key, JSON.stringify(chatMessage));

          //TODO: might need to limit the number of messages
          // TODO: if chatRoom is inactive for a long time, remove the chatRoom
        }
      }
    } catch (error) {
      console.error(error);
    }
  }

  public async retrieveMessages(chatRoomId: string): Promise<ChatMessage[] | null | undefined> {
    try {
      if (chatRoomId) {
        const key = `chatRoom:${chatRoomId}:messages`;
        const result = await this.redisClient.lRange(key, 0, -1);
        const chatMessages = result.map(element => JSON.parse(element)) as ChatMessage[];

        return chatMessages;
      }
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  public async deleteChatRoomMessagesById(chatRoomId: string): Promise<void> {
    try {
      if (chatRoomId) {
        const chatRoom = await this.getChatRoomById(chatRoomId);

        if (!chatRoom) {
          const key = `chatRoom:${chatRoomId}:messages`;
          await this.redisClient.DEL(key);
        }
      }
    } catch (error) {
      console.error(error);
    }
  }

  public async setLastActiveTimeBySocketId(socketId: string, lastActiveTime: string): Promise<void> {
    try {
      if (socketId && lastActiveTime) {
        await this.redisClient.set(`user:${socketId}:lastActiveTime`, lastActiveTime);
      }
    } catch (error) {
      console.error(error);
    }
  }

  public async getLastActiveTimeBySocketId(socketId: string): Promise<string | null | undefined> {
    try {
      if (socketId) {
        const lastActiveTime = await this.redisClient.get(`user:${socketId}:lastActiveTime`);

        return lastActiveTime ? lastActiveTime : null;
      }
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  public async deleteLastActiveTimeBySocketId(socketId: string): Promise<void> {
    try {
      if (socketId) {
        await this.redisClient.DEL(`user:${socketId}:lastActiveTime`);
      }
    } catch (error) {
      console.error(error);
    }
  }

  public async getMissedMessages(chatRoomId: string, lastActiveTime: string | null | undefined): Promise<ChatMessage[] | null | undefined> {
    try {
      if (chatRoomId && lastActiveTime) {
        const key = `chatRoom:${chatRoomId}:messages`;
        const result = await this.redisClient.lRange(key, 0, -1);
        const chatMessages = result.map(element => JSON.parse(element)) as ChatMessage[];

        return chatMessages.filter(chatMessages => new Date(chatMessages.timestamp) > new Date(lastActiveTime));
      }
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  public async isEventProcessed(eventId: string, eventName: string): Promise<boolean> {
    try {
      const isEventExisted = await this.redisClient.zScore('processedEvents', `${eventName}:${eventId}`);
      this.removeOldEvents();

      return isEventExisted !== null;
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  public async storeEvent(eventId: string, eventName: string): Promise<void> {
    try {
      const score = Math.floor(Date.now() / 1000); // Current timestamp in seconds

      await this.redisClient.zAdd('processedEvents', { score, value: `${eventName}:${eventId}` });
      this.removeOldEvents();
    } catch (error) {
      console.error(error);
    }
  }

  public async removeOldEvents(): Promise<void> {
    const threshold = Math.floor(Date.now() / 1000) - 5 * 60; // 5 mins ago
    await this.redisClient.zRemRangeByScore('processedEvents', '-inf', threshold);
  }

  public async processSocketEvent(event: string, eventId: string): Promise<boolean> {
    const iseventprocessed = await this.isEventProcessed(eventId, event);

    if (iseventprocessed) {
      console.log(`${event}:${eventId} has already processed.`);
      return true;
    } else {
      await this.storeEvent(eventId, event);
      return false;
    }
  }

  public async removeUserMessageIds(socketId: string, chatRoomId: string): Promise<void> {
    // Fetch all message IDs from the chat room
    const key = `chatRoom:${chatRoomId}:messages`;
    const messageStrings = await this.redisClient.lRange(key, 0, -1);
    const messages = messageStrings.map(msg => JSON.parse(msg)) as ChatMessage[];

    // Filter out messages sent by the user
    const userMessageIds = messages.filter(msg => msg.sender === socketId).map(msg => msg.id);

    // Remove each of the user's message IDs from the chatMessageIds set
    for (const messageId of userMessageIds) {
      await this.redisClient.sRem('chatMessageIds', messageId);
    }
  }
}
