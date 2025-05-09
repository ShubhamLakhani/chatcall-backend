import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Socket } from 'socket.io';
import { ReportUser } from 'src/schemas/reportUser/reportUser.schema';
import { ReportUserModelService } from 'src/schemas/reportUser/reportUser.service';
import { UserModelService } from 'src/schemas/user/user.service';

@Injectable()
export class ReportUserService {
  constructor(
    private reportUserModelService: ReportUserModelService,
    private userModelService: UserModelService,
  ) {}

  async reportUser(client: Socket, value: ReportUser) {
    const { reporter, reported } = value;
    if (reporter === reported) {
      throw new BadRequestException("You can't report yourself");
    }

    const target = await this.userModelService.finedUserById(reported);
    console.log('🚀 ~ BlockedUserService ~ blockUser ~ target:', target);

    if (!target) throw new NotFoundException('User not found');

    await this.reportUserModelService.createReportUser(value);

    client.emit('report-user', {
      success: true,
      message: 'Reported user',
      data: null,
    });
  }
}
