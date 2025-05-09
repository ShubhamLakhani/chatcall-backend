import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { IResponse } from 'src/common/common.interface';
import { BlockedUserModelService } from 'src/schemas/blockedUser/blockedUser.service';
import { UserModelService } from 'src/schemas/user/user.service';

@Injectable()
export class BlockedUserService {
  constructor(
    private blockedUserModelService: BlockedUserModelService,
    private userModelService: UserModelService,
  ) {}

  async blockUser(userId: string, targetUserId: string): Promise<IResponse> {
    if (userId === targetUserId) {
      throw new BadRequestException("You can't block yourself");
    }

    const target = await this.userModelService.finedUserById(targetUserId);
    console.log('🚀 ~ BlockedUserService ~ blockUser ~ target:', target);

    if (!target) throw new NotFoundException('User not found');

    await this.blockedUserModelService.blockUser(userId, targetUserId);

    return {
      success: true,
      message: 'User blocked',
      data: null,
    };
  }

  async unblockUser(userId: string, targetUserId: string): Promise<IResponse> {
    const user = await this.userModelService.finedUserById(userId);
    if (!user) throw new NotFoundException('User not found');

    await this.blockedUserModelService.unblockUser(userId, targetUserId);

    return {
      success: true,
      message: 'User unblocked',
      data: null,
    };
  }
}
