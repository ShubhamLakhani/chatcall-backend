import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { DeleteResult, Model, UpdateResult } from 'mongoose';
import { User } from './user.schema';
import { ModuleType } from 'src/enums';

@Injectable()
export class UserModelService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
  ) {}

  craeteUser(value: User): Promise<User> {
    return this.userModel.create(value);
  }

  create(value: Partial<User>): Promise<User> {
    return this.userModel.create(value);
  }

  findByEmail(email: string): Promise<User | null> {
    return this.userModel.findOne({ email }).exec();
  }

  finedUserBySocketId(
    socketId: string,
    moduleType: ModuleType,
  ): Promise<User | null> {
    return this.userModel.findOne({ socketId, moduleType });
  }

  updateUserBySocketIds(
    socketId: string[],
    isMatched: boolean,
  ): Promise<UpdateResult> {
    return this.userModel.updateMany(
      { socketId: { $in: socketId } },
      { isMatched },
    );
  }

  removeUserBySocketId(socketId: string): Promise<DeleteResult> {
    return this.userModel.deleteOne({ socketId });
  }

  finedAvailableUser(userId: string): Promise<User[]> {
    return this.userModel.aggregate([
      {
        $match: {
          isMatched: false,
          socketId: { $ne: null },
          _id: { $ne: userId },
        },
      },
      {
        $lookup: {
          from: 'blockedusers',
          let: {
            userId,
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    {
                      $eq: ['$blocker', '$$userId'],
                    },
                    {
                      $eq: ['$blocked', '$$userId'],
                    },
                  ],
                },
              },
            },
          ],
          as: 'blockedInfo',
        },
      },
      {
        $match: {
          blockedInfo: { $eq: [] },
        },
      },
      {
        $sample: { size: 1 },
      },
    ]);
  }

  finedUserById(userId: string): Promise<User | null> {
    return this.userModel.findById(userId);
  }

  updateUserByIds(
    socketId: string[],
    isMatched: boolean,
  ): Promise<UpdateResult> {
    return this.userModel.updateMany(
      { socketId: { $in: socketId } },
      { isMatched, socketId: null },
    );
  }

  updateUserSocketBySocketId(
    socketId: string,
    isMatched: boolean,
  ): Promise<UpdateResult> {
    return this.userModel.updateMany(
      { socketId },
      { isMatched, socketId: null },
    );
  }

  upsertUser(value: User): Promise<User> {
    if (!value.deviceId || value.deviceId.trim() === '') {
      throw new Error('upsertUser requires a valid, non-empty deviceId');
    }
    return this.userModel.findOneAndUpdate(
      {
        deviceId: value.deviceId,
        moduleType: value.moduleType,
      },
      {
        $set: value,
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      },
    );
  }
  updateUserSocketIdById(id: string, socketId: string): Promise<UpdateResult> {
    return this.userModel.updateOne({ _id: id }, { $set: { socketId } });
  }

  async sendFriendRequest(fromUserId: string, toUserId: string): Promise<UpdateResult> {
    return this.userModel.updateOne(
      { _id: toUserId },
      { $addToSet: { friendRequests: fromUserId } }
    );
  }

  async acceptFriendRequest(userId: string, targetUserId: string): Promise<void> {
    // Add targetUserId to userId's friends list, and remove it from pending requests
    await this.userModel.updateOne(
      { _id: userId },
      {
        $addToSet: { friends: targetUserId },
        $pull: { friendRequests: targetUserId }
      }
    );
    // Add userId to targetUserId's friends list
    await this.userModel.updateOne(
      { _id: targetUserId },
      { $addToSet: { friends: userId } }
    );
  }

  async declineFriendRequest(userId: string, targetUserId: string): Promise<UpdateResult> {
    return this.userModel.updateOne(
      { _id: userId },
      { $pull: { friendRequests: targetUserId } }
    );
  }

  async addCallReward(userId: string): Promise<User | null> {
    return this.userModel.findOneAndUpdate(
      { _id: userId },
      { $inc: { coins: 10, streakCount: 1 } },
      { new: true }
    ).exec();
  }

  async deductCoins(userId: string, amount: number): Promise<User | null> {
    return this.userModel.findOneAndUpdate(
      { _id: userId, coins: { $gte: amount } },
      { $inc: { coins: -amount } },
      { new: true }
    ).exec();
  }

  async addCoins(userId: string, amount: number): Promise<User | null> {
    return this.userModel.findOneAndUpdate(
      { _id: userId },
      { $inc: { coins: amount } },
      { new: true }
    ).exec();
  }

  async subscribeVip(userId: string, durationDays: number): Promise<User | null> {
    const user = await this.userModel.findById(userId);
    if (!user) return null;
    if (user.coins < 200) return null;

    const now = new Date();
    let newExpiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

    if (user.isVip && user.vipExpiresAt && new Date(user.vipExpiresAt).getTime() > now.getTime()) {
      newExpiresAt = new Date(new Date(user.vipExpiresAt).getTime() + durationDays * 24 * 60 * 60 * 1000);
    }

    return this.userModel.findOneAndUpdate(
      { _id: userId, coins: { $gte: 200 } },
      {
        $inc: { coins: -200 },
        $set: {
          isVip: true,
          vipExpiresAt: newExpiresAt
        }
      },
      { new: true }
    ).exec();
  }
}
