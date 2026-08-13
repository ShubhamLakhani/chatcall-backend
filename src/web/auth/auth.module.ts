import { Module } from '@nestjs/common';
import { BlockedUserSchemaModule } from 'src/schemas/blockedUser/blockedUser.module';
import { UserSchemaModule } from 'src/schemas/user/user.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [UserSchemaModule, BlockedUserSchemaModule],
  providers: [AuthService],
  controllers: [AuthController],
})
export class AuthModule {}
