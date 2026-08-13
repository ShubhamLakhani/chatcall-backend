import { Module } from '@nestjs/common';
import { BlockedUserModule } from './blockedUser/blockedUser.module';
import { ChatModule } from './chat/chat.module';
import { ReportUserModule } from './reportUser/reportUser.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [ChatModule, BlockedUserModule, ReportUserModule, AuthModule],
})
export class WebModule {}
