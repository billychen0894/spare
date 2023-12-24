import { RedisClientType, createClient } from 'redis';

export class RedisClient {
  private static instance: RedisClient;
  private client: RedisClientType;

  private constructor() {
    this.client = createClient();
    this.client.on('connection', () => {
      console.log('🚀 Connected to Redis');
    });

    this.client.on('error', err => {
      console.error('Redis Error: ', err);
    });

    this.client.connect();
  }

  public static getInstance(): RedisClient {
    if (!RedisClient.instance) {
      RedisClient.instance = new RedisClient();
    }

    return RedisClient.instance;
  }

  public getClient(): RedisClientType {
    return this.client;
  }
}
