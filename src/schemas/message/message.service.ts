// src/schemas/message/message.service.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Message } from './message.schema';
import { Model } from 'mongoose';

@Injectable()
export class MessageModelService {
  constructor(@InjectModel(Message.name) private messageModel: Model<Message>) {}

  async saveMessage(data: Partial<Message>): Promise<Message> {
    return this.messageModel.create(data);
  }

  async getMessages(chatRoomId: string): Promise<Message[]> {
    return this.messageModel.find({ chatRoomId }).sort({ createdAt: 1 }).exec();
  }

  async markMessagesAsRead(chatRoomId: string, userId: string): Promise<void> {
    await this.messageModel.updateMany(
      { chatRoomId, receiver: userId, read: false },
      { $set: { read: true, readAt: new Date() } },
    );
  }
}
