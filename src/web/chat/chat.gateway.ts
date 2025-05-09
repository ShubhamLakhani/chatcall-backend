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

@WebSocketGateway({ cors: {
  origin: ['*'], // or same exact ngrok domain
  credentials: true,
}, })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly chatService: ChatService) {}
  private matchedUsers = new Set<string>();

  handleConnection(socket: Socket) {
    console.log(`Connected: ${socket.id}`);
    // await this.chatService.registerUser(socket.id);
  }

  async handleDisconnect(socket: Socket) {
    this.matchedUsers.delete(socket.id);
    console.log(`Disconnected: ${socket.id}`);
    await this.chatService.updateUserBySocketId(socket.id);
    // await this.chatService.removeUser(socket.id);
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
    }

    const tryMatch = async () => {
      const room = await this.chatService.findMatch(client.id, data);
      if (room) {
        this.matchedUsers.add(room.user1);
        this.matchedUsers.add(room.user2);
        client.emit('matched', { chatRoomId: room._id, initiator: true,  });
        const partnerId = room.user1 === client.id ? room.user2 : room.user1;
        client.to(partnerId).emit('matched', { chatRoomId: room._id, initiator: false });
        return true;
      }
      return false;
    };

    if (await tryMatch()) return;

    client.emit('waiting', 'Waiting for a match...');

    // Start polling every 20s until matched or disconnected
    // const intervalId = setInterval(() => {
    //   void (async () => {
    //     const matched = await tryMatch();
    //     if (matched) {
    //       clearInterval(intervalId);
    //     } else {
    //       client.emit('waiting', 'Waiting for a match...');
    //     }
    //   })();
    // }, 200);
    let matched = false;
    const checkInterval = 10000; // 10 seconds interval to check for a match
    while (!matched && client.connected && !this.matchedUsers.has(client.id)) {
      matched = await tryMatch();
      if (!matched) {
        client.emit('waiting', 'Waiting for a match...');
        await new Promise((resolve) => setTimeout(resolve, checkInterval));
      }
    }

    // Clean up if user disconnects
    // client.once('disconnect', () => {
    //   clearInterval(intervalId);
    // });
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

  @SubscribeMessage('start-call')
  async onStartCall(
    @MessageBody() data: { chatRoomId: string },
    @ConnectedSocket() client: Socket,
  ) {
    console.log('start-call', data);
    const receiver = await this.chatService.getReceiver(
      client.id,
      data.chatRoomId,
    );
    console.log('receiver', receiver);
    if (receiver) {
      this.server.to(receiver).emit('call-started', { from: client.id });
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
