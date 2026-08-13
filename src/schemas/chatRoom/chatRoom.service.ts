import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ChatRoom } from './chatRoom.schema';

@Injectable()
export class ChatRoomModelService {
  constructor(
    @InjectModel(ChatRoom.name)
    private readonly chatRoomModel: Model<ChatRoom>,
  ) {}

  createChatRoom(user1: string, user2: string): Promise<ChatRoom> {
    const filter = {
      $or: [
        { user1, user2 },
        { user1: user2, user2: user1 },
      ],
    };

    const update = { user1, user2 };

    return this.chatRoomModel.findOneAndUpdate(filter, update, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    });
  }

  async createChatRoomWithId(roomId: string, user1: string, user2: string): Promise<ChatRoom> {
    const filter = {
      $or: [
        { user1, user2 },
        { user1: user2, user2: user1 },
      ],
    };

    const update = {
      $setOnInsert: { _id: roomId },
      $set: { user1, user2 },
    };

    return this.chatRoomModel.findOneAndUpdate(filter, update, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    });
  }

  findChatRoomById(chatRoomId: string): Promise<ChatRoom | null> {
    return this.chatRoomModel.findById(chatRoomId);
  }
}
