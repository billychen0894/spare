import { ChatMessage, CustomSocket } from '@/interfaces/sockets.interface';
import { RedisService } from '@/services/redis.service';
import { Server as IOServer } from 'socket.io';
import Container from 'typedi';

export class ChatRoomManager {
  private redisService: RedisService;
  private io: IOServer;

  constructor(io: IOServer) {
    this.redisService = Container.get(RedisService);
    this.io = io;

    // check inactivity of chatRooms in every one hour
    setInterval(
      () => {
        this.checkInactiveChatRooms().catch(console.error);
      },
      // 60 * 60 * 1000,
      30 * 1000,
    );
  }

  public startChat(socket: CustomSocket, event: string): void {
    socket.on(event, async (userId, eventId, callback: any) => {
      const isEventProcessed = await this.redisService.processSocketEvent(event, eventId);

      if (isEventProcessed) return;

      // Check user session if it's already existed in Redis
      if (socket.sessionId && socket.chatRoomId) {
        const userStatus = await this.redisService.checkUserStatus(socket.sessionId);
        const chatRoom = await this.redisService.getChatRoomById(socket.chatRoomId);

        if (chatRoom) {
          const participants = Array.from(chatRoom.participants);
          const isUserInRoom = participants.includes(socket.sessionId);

          if (userStatus === 'in-chat' && isUserInRoom) {
            socket.join(socket.chatRoomId);
            socket.emit('chatRoom-created', { id: socket.chatRoomId, state: chatRoom.state, participants: chatRoom.participants });

            callback();
            return;
          }
        }
      }

      await this.redisService.addUserToQueue(userId);
      const chatRoom = await this.redisService.pairUsers();

      if (chatRoom) {
        const otherPairedUserId = Array.from(chatRoom.participants).find(id => id !== userId);

        // If it's paired, update chatRoomId in session obj
        socket.emit('session', { sessionId: socket.sessionId, chatRoomId: chatRoom.id });
        socket.join(chatRoom.id);
        socket.emit('chatRoom-created', chatRoom);

        if (otherPairedUserId) {
          this.io?.of('/chat').in(otherPairedUserId).socketsJoin(chatRoom.id);
          this.io?.of('/chat').to(otherPairedUserId).emit('session', { sessionId: otherPairedUserId, chatRoomId: chatRoom.id });
          this.io?.of('/chat').to(otherPairedUserId).emit('chatRoom-created', chatRoom);
        }
      }
      callback({
        status: 'ok',
      });
    });
  }

  // TODO: On disconnect the previous socket events are recovered with new socket, something to do with acknowledgement
  public leaveChatRoom(socket: CustomSocket, event: string): void {
    socket.on(event, async (chatRoomId: string, eventId: string, callback: any) => {
      const isEventProcessed = await this.redisService.processSocketEvent(event, eventId);

      if (isEventProcessed) return;

      if (chatRoomId && socket.sessionId) {
        socket.to(chatRoomId).emit('left-chat', socket.sessionId);
        socket.leave(chatRoomId);

        await this.redisService.clearUser(socket.sessionId, chatRoomId);
      }
      callback({
        status: 'ok',
      });
    });
  }

  public sendMessage(socket: CustomSocket, event: string): void {
    socket.on(event, async (chatRoomId: string, chatMessage: ChatMessage, eventId, callback: any) => {
      try {
        const isEventProcessed = await this.redisService.processSocketEvent(event, eventId);

        if (isEventProcessed) return;

        socket.to(chatRoomId).emit('receive-message', chatMessage);

        // store messages to Redis
        await this.redisService.storeMessage(chatRoomId, chatMessage);
        callback({
          status: 'ok',
        });
      } catch (error) {
        console.error(error);
      }
    });
  }

  public retrieveChatMessages(socket: CustomSocket, event: string): void {
    socket.on(event, async (chatRoomId: string, eventId, callback: any) => {
      try {
        const isEventProcessed = await this.redisService.processSocketEvent(event, eventId);

        if (isEventProcessed) return;

        // Retrieve chat messages from Redis
        const chatMessages = await this.redisService.retrieveMessages(chatRoomId);

        if (chatMessages) {
          this.io?.of('/chat').to(chatRoomId).emit('chat-history', chatMessages);
        }

        callback({
          status: 'ok',
        });
      } catch (error) {
        console.error(error);
      }
    });
  }

  public disconnect(socket: CustomSocket, event: string): void {
    socket.on(event, async () => {
      try {
        if (socket.sessionId) {
          const userStatus = await this.redisService.checkUserStatus(socket.sessionId);

          if (userStatus === 'waiting') {
            await this.redisService.removeUserFromQueue(socket.sessionId);
            await this.redisService.removeUserSessionId(socket.sessionId);
          }

          if (userStatus === 'in-chat') {
            const lastActiveTime = new Date().toISOString();
            await this.redisService.setLastActiveTimeBySocketId(socket.sessionId, lastActiveTime);
          }
        }
      } catch (error) {
        console.error(error);
      }
    });
  }

  public async checkInactiveChatRooms(): Promise<void> {
    try {
      const chatRooms = await this.redisService.getAllChatRooms();

      if (chatRooms && chatRooms?.length > 0) {
        for (const chatRoom of chatRooms) {
          // const thresholdInSeconds = 2 * 24 * 60 * 60; // two days;
          const thresholdInSeconds = 30; // 30 sec;
          const isInactive = await this.redisService.isInactive(`chatRoom:${chatRoom?.id}:lastActivity`, thresholdInSeconds);

          if (isInactive) {
            chatRoom.participants.forEach(async participant => {
              const userSessionId = await this.redisService.getUserSessionId(participant);

              if (userSessionId) {
                await this.redisService.clearUser(userSessionId, chatRoom?.id);
              }
            });

            this.io
              ?.of('/chat')
              .to(chatRoom?.id)
              .emit('inactive-chatRoom', chatRoom);
          }
        }
      }
    } catch (error) {
      console.error(error);
    }
  }

  public checkChatRoomSession(socket: CustomSocket, event: string): void {
    socket.on(event, async (chatRoomId: string, sessionId: string, eventId: string, callback: any) => {
      try {
        const isEventProcessed = await this.redisService.processSocketEvent(event, eventId);

        if (isEventProcessed) return;

        const chatRoom = await this.redisService.getChatRoomById(chatRoomId);

        if (chatRoom && chatRoom.participants.includes(sessionId)) {
          socket.emit('receive-chatRoom-session', chatRoom);
        } else {
          socket.emit('receive-chatRoom-session', null);
          await this.redisService.removeUserSessionId(sessionId);
        }
        callback({
          status: 'ok',
        });
      } catch (error) {
        console.error(error);
      }
    });
  }
}
