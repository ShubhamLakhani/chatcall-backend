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
}
