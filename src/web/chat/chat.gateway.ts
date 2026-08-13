import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { User } from 'src/schemas/user/user.schema';
import { ChatService } from './chat.service';
import { MatchmakingQueueService } from 'src/common/redis/matchmaking-queue.service';
import { UserModelService } from 'src/schemas/user/user.service';
import { Types } from 'mongoose';
import { ICEBREAKERS } from 'src/common/constants/icebreakers';

@WebSocketGateway({ cors: {
  origin: ['*'], // or same exact ngrok domain
  credentials: true,
}, })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly chatService: ChatService,
    private readonly matchmakingQueueService: MatchmakingQueueService,
    private readonly userModelService: UserModelService,
  ) {}
  private matchedUsers = new Set<string>();
  private roomReady = new Map<string, Set<string>>();

  async afterInit(server: Server) {
    try {
      const redis = this.matchmakingQueueService.redisClient;
      await redis.del('online:users');
      await redis.del('socket:user');
      console.log('Cleared stale online user hashes from Redis.');
    } catch (err) {
      console.error('Failed to clear online user metrics on boot:', err);
    }

    // Periodically broadcast activity metrics
    setInterval(() => {
      void this.broadcastActivityMetrics();
    }, 5000);
  }

  async broadcastActivityMetrics() {
    try {
      const redis = this.matchmakingQueueService.redisClient;
      const totalOnline = (await redis.hlen('online:users')) || 0;

      const searchingChat = (await redis.zcard('queue:chat:general')) || 0;
      const searchingVoice = (await redis.zcard('queue:voice-call:general')) || 0;
      const searchingCount = searchingChat + searchingVoice;

      this.server.emit('live-users-count', {
        totalOnline: totalOnline > 0 ? totalOnline : this.server.sockets.sockets.size,
        searchingCount,
      });
    } catch (err) {
      console.error('Failed to broadcast activity metrics:', err);
    }
  }

  async handleConnection(socket: Socket) {
    console.log(`Connected: ${socket.id}`);
    try {
      let deviceId = socket.handshake.query?.deviceId as string;
      if (!deviceId || deviceId.trim() === '') {
        console.warn(`[SOCKET] Connection handshake query is missing deviceId for socket ${socket.id}. Falling back to socket.id.`);
        deviceId = socket.id;
      }

      const userInfo = await this.chatService.resolveUserByDeviceId(deviceId);
      socket.data.userInfo = userInfo;
      const userId = userInfo._id ? userInfo._id.toString() : '';

      if (userId) {
        const redis = this.matchmakingQueueService.redisClient;
        await redis.hincrby('online:users', userId, 1);
        await redis.hset('socket:user', socket.id, userId);
      }

      void this.broadcastActivityMetrics();
    } catch (err) {
      console.error('Error tracking socket connection:', err);
    }
  }

  async handleDisconnect(socket: Socket) {
    this.matchedUsers.delete(socket.id);
    console.log(`Disconnected: ${socket.id}`);

    try {
      const redis = this.matchmakingQueueService.redisClient;
      let userId = socket.data?.userInfo?._id?.toString();
      if (!userId) {
        userId = (await redis.hget('socket:user', socket.id)) || undefined;
      }

      if (userId) {
        const count = await redis.hincrby('online:users', userId, -1);
        if (count <= 0) {
          await redis.hdel('online:users', userId);
        }
        await redis.hdel('socket:user', socket.id);
      }

      void this.broadcastActivityMetrics();
    } catch (err) {
      console.error('Error tracking socket disconnection:', err);
    }

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

    const fromUsername = client.data.userInfo.username || client.data.userInfo.email || 'Anonymous';

    // Deduct 5 coins if searching using a specific gender or country filter
    const hasGenderFilter = (data as any).genderFilter && (data as any).genderFilter !== 'all';
    const hasCountryFilter = (data as any).countryFilter && (data as any).countryFilter !== '';
    if (hasGenderFilter || hasCountryFilter) {
      const updatedUser = await this.chatService.deductCoins(userId, 5);
      if (!updatedUser) {
        client.emit('insufficient-coins', { message: 'You need at least 5 coins to use match filters.' });
        return;
      }
      client.data.userInfo = updatedUser;
      client.emit('rewards-updated', {
        coins: updatedUser.coins,
        streakCount: updatedUser.streakCount,
      });
    }

    // 2. Add user to matchmaking queue (registers their metadata in Redis)
    await this.matchmakingQueueService.addToQueue(userId, client.id, {
      moduleType,
      tags,
      isShadowbanned,
      username: fromUsername,
      userGender: (data as any).userGender,
      userCountry: (data as any).userCountry,
      genderFilter: (data as any).genderFilter,
      countryFilter: (data as any).countryFilter,
    });

    // 3. Attempt to find a match instantly from the Redis matchmaking queue
    const partnerMeta = await this.matchmakingQueueService.findMatch(userId, {
      moduleType,
      tags,
      genderFilter: (data as any).genderFilter,
      countryFilter: (data as any).countryFilter,
    });

    if (partnerMeta) {
      // Match found!
      this.matchedUsers.add(client.id);
      this.matchedUsers.add(partnerMeta.socketId);

      // Pre-generate a unique Mongo ObjectId for the chat room
      const chatRoomId = new Types.ObjectId().toString();

      // Ensure both matched users join the Socket.IO room immediately
      void client.join(chatRoomId);
      const partnerSocket = this.server.sockets.sockets.get(partnerMeta.socketId);
      if (partnerSocket) {
        void partnerSocket.join(chatRoomId);
      }

      // Choose a random icebreaker
      const icebreaker = ICEBREAKERS[Math.floor(Math.random() * ICEBREAKERS.length)];

      // Instantly emit matched event to both users, passing partner ID, username, and icebreaker prompt
      client.emit('matched', {
        chatRoomId,
        initiator: true,
        moduleType,
        icebreaker,
        partner: {
          _id: partnerMeta.userId,
          username: partnerMeta.username,
        },
      });
      client.to(partnerMeta.socketId).emit('matched', {
        chatRoomId,
        initiator: false,
        moduleType,
        icebreaker,
        partner: {
          _id: userId,
          username: fromUsername,
        },
      });

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

  @SubscribeMessage('send-friend-request')
  async onSendFriendRequest(
    @MessageBody() data: { targetUserId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data?.userInfo?._id?.toString();
    if (!userId) return;

    const fromUsername = client.data.userInfo.username || client.data.userInfo.email || 'Anonymous';
    
    // Save in DB
    await this.chatService.sendFriendRequest(userId, data.targetUserId);

    // Retrieve target user socket ID to emit notification
    const targetUser = await this.chatService.getUserById(data.targetUserId);
    if (targetUser && targetUser.socketId) {
      console.log(`[FRIEND] Directing friend request from ${userId} to target socket: ${targetUser.socketId}`);
      this.server.to(targetUser.socketId).emit('friend-request-received', {
        fromUser: {
          _id: userId,
          username: fromUsername,
        },
      });
    }
  }

  @SubscribeMessage('accept-friend-request')
  async onAcceptFriendRequest(
    @MessageBody() data: { targetUserId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data?.userInfo?._id?.toString();
    if (!userId) return;

    const myUsername = client.data.userInfo.username || client.data.userInfo.email || 'Anonymous';

    // Accept in DB
    await this.chatService.acceptFriendRequest(userId, data.targetUserId);

    // Notify target user
    const targetUser = await this.chatService.getUserById(data.targetUserId);
    if (targetUser && targetUser.socketId) {
      console.log(`[FRIEND] Notifying target user ${data.targetUserId} that friend request was accepted.`);
      this.server.to(targetUser.socketId).emit('friend-request-accepted', {
        friend: {
          _id: userId,
          username: myUsername,
        },
      });
    }
  }

  @SubscribeMessage('decline-friend-request')
  async onDeclineFriendRequest(
    @MessageBody() data: { targetUserId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data?.userInfo?._id?.toString();
    if (!userId) return;

    await this.chatService.declineFriendRequest(userId, data.targetUserId);
  }

  @SubscribeMessage('reward-completed-call')
  async onRewardCompletedCall(
    @MessageBody() data: { callDuration: number },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data?.userInfo?._id?.toString();
    if (!userId) return;

    if (data.callDuration >= 60) {
      console.log(`[REWARD] Call duration ${data.callDuration}s >= 60s for user ${userId}. Granting rewards.`);
      const updatedUser = await this.chatService.addCallReward(userId);
      if (updatedUser) {
        client.data.userInfo = updatedUser;
        client.emit('rewards-updated', {
          coins: updatedUser.coins,
          streakCount: updatedUser.streakCount,
        });
      }
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
      this.server.to(data.chatRoomId).emit('receive-message', {
        content: data.content,
        sender: client.id,
      });
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

  @SubscribeMessage('request-new-icebreaker')
  onRequestNewIcebreaker(
    @MessageBody() data: { chatRoomId: string },
  ) {
    const { chatRoomId } = data;
    if (!chatRoomId) return;
    const newIcebreaker = ICEBREAKERS[Math.floor(Math.random() * ICEBREAKERS.length)];
    this.server.to(chatRoomId).emit('new-icebreaker', { icebreaker: newIcebreaker });
  }

  @SubscribeMessage('send-gift')
  async onSendGift(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { chatRoomId: string, giftId: string, giftCost: number, giftEmoji: string, giftName: string }
  ) {
    const { chatRoomId, giftId, giftCost, giftEmoji, giftName } = data;
    if (!chatRoomId || !giftId || !giftCost) return;

    const sender = await this.userModelService.findBySocketId(client.id);
    if (!sender || sender.coins < giftCost) {
      client.emit('gift-error', { message: 'Insufficient coins or user not found.' });
      return;
    }

    const recipientSocketId = await this.chatService.getReceiver(client.id, chatRoomId);
    if (!recipientSocketId) {
      client.emit('gift-error', { message: 'Partner not found.' });
      return;
    }

    const recipient = await this.userModelService.findBySocketId(recipientSocketId);
    if (!recipient) {
      client.emit('gift-error', { message: 'Recipient profile not found.' });
      return;
    }

    if (!sender._id || !recipient._id) {
      client.emit('gift-error', { message: 'Database identifiers not found.' });
      return;
    }

    const updatedBalances = await this.userModelService.transferGiftCoins(
      sender._id.toString(),
      recipient._id.toString(),
      giftCost,
    );
    if (!updatedBalances) {
      client.emit('gift-error', { message: 'Transaction failed.' });
      return;
    }

    this.server.to(chatRoomId).emit('receive-gift', {
      giftId,
      giftEmoji,
      giftName,
      senderName: sender.email ? sender.email.split('@')[0] : 'Anonymous',
      senderCoins: updatedBalances.senderCoins,
      recipientCoins: updatedBalances.recipientCoins,
      senderSocketId: client.id,
      recipientSocketId
    });
  }

  @SubscribeMessage('join-room')
  onJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { chatRoomId: string },
  ) {
    const { chatRoomId } = data;
    if (!chatRoomId) return;
    void client.join(chatRoomId);
    console.log(`[ROOM] Socket ${client.id} joined room ${chatRoomId}`);
  }
}
