import { Module } from '@nestjs/common';
import { BlockedUserSchemaModule } from 'src/schemas/blockedUser/blockedUser.module';
import { UserSchemaModule } from 'src/schemas/user/user.module';
import { BlockedUserGateway } from './blockedUser.gateway';
import { BlockedUserService } from './blockedUser.service';

@Module({
  imports: [UserSchemaModule, BlockedUserSchemaModule],
  providers: [BlockedUserGateway, BlockedUserService],
})
export class BlockedUserModule {}
