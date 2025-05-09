import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BlockedUser } from './blockedUser.schema';
import { DeleteResult } from 'mongodb';

@Injectable()
export class BlockedUserModelService {
  constructor(
    @InjectModel(BlockedUser.name)
    private readonly blockedModel: Model<BlockedUser>,
  ) {}

  async isBlocked(userId: string, targetId: string): Promise<boolean> {
    const block = await this.blockedModel.findOne({
      $or: [
        { blocker: userId, blocked: targetId },
        { blocker: targetId, blocked: userId },
      ],
    });

    return !!block;
  }

  blockUser(userId: string, targetId: string): Promise<BlockedUser | null> {
    return this.blockedModel.findOneAndUpdate(
      { blocker: userId, blocked: targetId },
      { $set: { blocker: userId, blocked: targetId } },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      },
    );
  }

  unblockUser(userId: string, targetId: string): Promise<DeleteResult> {
    return this.blockedModel.deleteOne({ blocker: userId, blocked: targetId });
  }
}
