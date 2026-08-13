/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { User } from 'src/schemas/user/user.schema';
import { ChatService } from './chat.service';
import { MatchmakingQueueService } from 'src/common/redis/matchmaking-queue.service';
import { Types } from 'mongoose';

@WebSocketGateway({ cors: {
  origin: ['*'], // or same exact ngrok domain
  credentials: true,
}, })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly chatService: ChatService,
    private readonly matchmakingQueueService: MatchmakingQueueService,
  ) {}
  private matchedUsers = new Set<string>();
  private roomReady = new Map<string, Set<string>>();

  handleConnection(socket: Socket) {
    console.log(`Connected: ${socket.id}`);
    // await this.chatService.registerUser(socket.id);
  }

  async handleDisconnect(socket: Socket) {
    this.matchedUsers.delete(socket.id);
    console.log(`Disconnected: ${socket.id}`);

    // Remove user from matchmaking queue immediately on disconnect
    const userId = socket.data?.userInfo?._id?.toString();
    if (userId) {
      await this.matchmakingQueueService.removeFromQueue(userId);
    }

    await this.chatService.updateUserBySocketId(socket.id);
    // await this.chatService.removeUser(socket.id);

    // Clean up roomReady map
    for (const [roomId, readyUsers] of this.roomReady.entries()) {
      if (readyUsers.has(socket.id)) {
        readyUsers.delete(socket.id);
        if (readyUsers.size === 0) {
          this.roomReady.delete(roomId);
        }
      }
    }
  }

  @SubscribeMessage('find-match')
  async onFindMatch(
    @MessageBody() data: User,
    @ConnectedSocket() client: Socket,
  ) {
    data.socketId = client.id;
    if (this.matchedUsers.has(client.id)) {
      return; // Already matched
    }
    console.log('client.data...>>>', client.data);
    if (!client.data?.userInfo) {
      console.log('data.....>>>', data);
      await this.chatService.createOrUpdateByDeviceId(data, client);
    } else {
      await this.chatService.updateUserSockedIdById(
        client.data.userInfo._id,
        client.id,
      );
      // Fetch latest user details to get updated flags (e.g. isShadowbanned)
      const user = await this.chatService.getUserById(client.data.userInfo._id);
      if (user) {
        client.data.userInfo = user;
      }
    }

    const userId = client.data.userInfo._id.toString();

    // 1. Sliding-window rate limit check
    const rateLimitExceeded = await this.matchmakingQueueService.checkRateLimit(userId);
    if (rateLimitExceeded) {
      console.warn(`Rate limit exceeded for user ${userId}. Triggering captcha challenge.`);
      client.emit('captcha-required');
      return;
    }

    const moduleType = data.moduleType;
    const tags = (data as any).tags || [];
    const isShadowbanned = client.data.userInfo.isShadowbanned || false;

    // 2. Add user to matchmaking queue (registers their metadata in Redis)
    await this.matchmakingQueueService.addToQueue(userId, client.id, {
      moduleType,
      tags,
      isShadowbanned,
    });

    // 3. Attempt to find a match instantly from the Redis matchmaking queue
    const partnerMeta = await this.matchmakingQueueService.findMatch(userId, {
      moduleType,
      tags,
    });

    if (partnerMeta) {
      // Match found!
      this.matchedUsers.add(client.id);
      this.matchedUsers.add(partnerMeta.socketId);

      // Pre-generate a unique Mongo ObjectId for the chat room
      const chatRoomId = new Types.ObjectId().toString();

      // Instantly emit matched event to both users
      client.emit('matched', { chatRoomId, initiator: true, moduleType });
      client.to(partnerMeta.socketId).emit('matched', { chatRoomId, initiator: false, moduleType });

      // Perform MongoDB writes asynchronously in the background
      void (async () => {
        try {
          // Update user matched status in MongoDB
          await this.chatService.updateUserBySocketIds(
            [client.id, partnerMeta.socketId],
            true,
          );
          // Create ChatRoom document in MongoDB
          await this.chatService.createChatRoomWithId(
            chatRoomId,
            client.id,
            partnerMeta.socketId,
          );
        } catch (error) {
          console.error('Failed to asynchronously initialize match in MongoDB:', error);
        }
      })();
    } else {
      // User remains in the queue. Emit waiting event
      client.emit('waiting', 'Waiting for a match...');
    }
  }

  @SubscribeMessage('verify-captcha')
  async onVerifyCaptcha(
    @MessageBody() data: { token: string },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data?.userInfo?._id?.toString();
    if (!userId) {
      return client.emit('verify-captcha-response', { success: false, error: 'User not authenticated' });
    }

    if (data && data.token) {
      await this.matchmakingQueueService.clearRateLimit(userId);
      console.log(`Captcha verified successfully for user: ${userId}`);
      client.emit('verify-captcha-response', { success: true });
    } else {
      client.emit('verify-captcha-response', { success: false, error: 'Invalid token' });
    }
  }

  @SubscribeMessage('cancel-search')
  async onCancelSearch(@ConnectedSocket() client: Socket) {
    const userId = client.data?.userInfo?._id?.toString();
    if (userId) {
      await this.matchmakingQueueService.removeFromQueue(userId);
      console.log(`Matchmaking search cancelled for user: ${userId}`);
      client.emit('search-cancelled', { success: true });
    }
  }

  @SubscribeMessage('send-message')
  async onSendMessage(
    @MessageBody() data: { chatRoomId: string; content: string },
    @ConnectedSocket() client: Socket,
  ) {
    const receiver = await this.chatService.getReceiver(
      client.id,
      data.chatRoomId,
    );
    if (receiver) {
      await this.chatService.saveMessage({
        chatRoomId: data.chatRoomId,
        sender: client.id,
        receiver,
        content: data.content,
      });
      if (this.matchedUsers.has(receiver)) {
        client.to(receiver).emit('receive-message', {
          content: data.content,
          sender: client.id,
        });
      } else {
        client.emit('user-leave-room', {
          success: true,
          message: 'User left',
          data: null,
        });
      }
    }
  }

  @SubscribeMessage('typing')
  async onTyping(
    @MessageBody() data: { chatRoomId: string }, 
    @ConnectedSocket() client: Socket
  ) {
    const receiver = await this.chatService.getReceiver(client.id, data.chatRoomId);
    if (receiver) this.server.to(receiver).emit('typing', { from: client.id });
  }

  @SubscribeMessage('stop-typing')
  async onStopTyping(@MessageBody() data: { chatRoomId: string }, @ConnectedSocket() client: Socket) {
    const receiver = await this.chatService.getReceiver(client.id, data.chatRoomId);
    if (receiver) this.server.to(receiver).emit('stop-typing', { from: client.id });
  }

  @SubscribeMessage('mark-read')
  async onMarkRead(@MessageBody() data: { chatRoomId: string }, @ConnectedSocket() client: Socket) {
    await this.chatService.markMessagesAsRead(data.chatRoomId, client.id);
    const receiver = await this.chatService.getReceiver(client.id, data.chatRoomId);
    if (receiver) {
      this.server.to(receiver).emit('messages-read', { from: client.id });
    }
  }

  @SubscribeMessage('start-call')
  async onStartCall(
    @MessageBody() data: { chatRoomId: string },
    @ConnectedSocket() client: Socket,
  ) {
    console.log('start-call', data);
    const { chatRoomId } = data;
    if (!chatRoomId) return;

    let readyUsers = this.roomReady.get(chatRoomId);
    if (!readyUsers) {
      readyUsers = new Set<string>();
      this.roomReady.set(chatRoomId, readyUsers);
    }
    readyUsers.add(client.id);

    console.log(`Room ${chatRoomId} readiness: ${readyUsers.size}/2`);

    if (readyUsers.size === 2) {
      const [user1, user2] = Array.from(readyUsers);
      this.server.to(user1).emit('call-started', { from: user2 });
      this.server.to(user2).emit('call-started', { from: user1 });
      this.roomReady.delete(chatRoomId);
      console.log(`Room ${chatRoomId} is fully synchronized. call-started emitted.`);
    }
  }

  @SubscribeMessage('webrtc-offer')
  onWebRTCOffer(
    @MessageBody() data: { to: string; offer: any },
    @ConnectedSocket() client: Socket,
  ) {
    this.server
      .to(data.to)
      .emit('webrtc-offer', { offer: data.offer, from: client.id });
  }

  @SubscribeMessage('webrtc-answer')
  onWebRTCAnswer(
    @MessageBody() data: { to: string; answer: any },
    @ConnectedSocket() client: Socket,
  ) {
    this.server
      .to(data.to)
      .emit('webrtc-answer', { answer: data.answer, from: client.id });
  }

  @SubscribeMessage('webrtc-ice-candidate')
  onICECandidate(
    @MessageBody() data: { to: string; candidate: any },
    @ConnectedSocket() client: Socket,
  ) {
    this.server.to(data.to).emit('webrtc-ice-candidate', {
      candidate: data.candidate,
      from: client.id,
    });
  }

  @SubscribeMessage('leave-room')
  async onLeaveRoom(
    @MessageBody() data: { chatRoomId: string },
    @ConnectedSocket() client: Socket,
  ) {
    this.roomReady.delete(data.chatRoomId);
    const roomData = await this.chatService.leaveRoom(client, data.chatRoomId);
    this.matchedUsers.delete(roomData?.data?.user1 as string);
    this.matchedUsers.delete(roomData?.data?.user2 as string);

    const receiver = (
      roomData?.data?.user1 === client.id
        ? roomData?.data?.user2
        : roomData?.data?.user1
    ) as string;

    client.to(receiver).emit('leave-room', {
      success: true,
      message: 'Room left',
      data: null,
    });

    return client.emit('leave-room', {
      success: true,
      message: 'Room left',
      data: null,
    });
  }
}
