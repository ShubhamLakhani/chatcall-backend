import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BlockedUser, BlockedUserSchema } from './blockedUser.schema';
import { BlockedUserModelService } from './blockedUser.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BlockedUser.name, schema: BlockedUserSchema },
    ]),
  ],
  providers: [BlockedUserModelService],
  exports: [MongooseModule, BlockedUserModelService],
})
export class BlockedUserSchemaModule {}
