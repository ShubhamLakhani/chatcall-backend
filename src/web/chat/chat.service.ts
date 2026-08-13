import { Injectable } from '@nestjs/common';
import { Socket } from 'socket.io';
import { BlockedUserModelService } from 'src/schemas/blockedUser/blockedUser.service';
import { ChatRoom } from 'src/schemas/chatRoom/chatRoom.schema';
import { ChatRoomModelService } from 'src/schemas/chatRoom/chatRoom.service';
import { Message } from 'src/schemas/message/message.schema';
import { MessageModelService } from 'src/schemas/message/message.service';
import { User } from 'src/schemas/user/user.schema';
import { UserModelService } from 'src/schemas/user/user.service';

@Injectable()
export class ChatService {
  constructor(
    private userModelService: UserModelService,
    private chatRoomModelService: ChatRoomModelService,
    private messageModelService: MessageModelService,
    private blockedUserModelService: BlockedUserModelService,
  ) {}

  async registerUser(value: User): Promise<User> {
    return this.userModelService.craeteUser(value);
  }

  async saveMessage(payload: Partial<Message>) {
    return this.messageModelService.saveMessage(payload);
  }

  async markMessagesAsRead(chatRoomId: string, userId: string) {
    return this.messageModelService.markMessagesAsRead(chatRoomId, userId);
  }

  async findMatch(socketId: string, data: User): Promise<ChatRoom | null> {
    console.log("🚀 ~ ChatService ~ findMatch ~ socketId:", socketId)
    
    const user = await this.userModelService.finedUserBySocketId(
      socketId,
      data.moduleType,
    );
    if (!user || user.isMatched) return null;

    const [available] = await this.userModelService.finedAvailableUser(
      user._id as string,
    );

    if (available) {
      console.log("🚀 ~ ChatService ~ findMatch ~ available:", available)
      await this.userModelService.updateUserBySocketIds(
        [socketId, available.socketId],
        true,
      );

      const room = await this.chatRoomModelService.createChatRoom(
        socketId,
        available.socketId,
      );

      return room;
    }

    return null;
  }

  async removeUser(socketId: string) {
    await this.userModelService.removeUserBySocketId(socketId);
  }

  async getReceiver(
    socketId: string,
    chatRoomId: string,
  ): Promise<string | null> {
    const room = await this.chatRoomModelService.findChatRoomById(chatRoomId);
    if (!room) return null;

    console.log('🚀 ~ getReceiver ~ room:', socketId);

    return room.user1 === socketId ? room.user2 : room.user1;
  }

  async leaveRoom(client: Socket, chatRoomId: string) {
    const room = await this.chatRoomModelService.findChatRoomById(chatRoomId);
    if (!room) return;

    await this.userModelService.updateUserByIds(
      [room.user1, room.user2],
      false,
    );

    return {
      success: true,
      data: room,
    };
  }

  async createOrUpdateByDeviceId(value: User, client: Socket): Promise<void> {
    const { deviceId } = value;
    let userInfo: User | null = null;

    if (!deviceId) {
      userInfo = await this.userModelService.craeteUser(value);
    }

    userInfo = await this.userModelService.upsertUser(value);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    client.data.userInfo = userInfo;
  }

  updateUserBySocketId(socketId: string) {
    return this.userModelService.updateUserSocketBySocketId(socketId, false);
  }

  updateUserSockedIdById(id: string, socketId: string) {
    return this.userModelService.updateUserSocketIdById(id, socketId);
  }
}
