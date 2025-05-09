import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatRoom, ChatRoomSchema } from './chatRoom.schema';
import { ChatRoomModelService } from './chatRoom.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ChatRoom.name, schema: ChatRoomSchema },
    ]),
  ],
  providers: [ChatRoomModelService],
  exports: [MongooseModule, ChatRoomModelService],
})
export class ChatRoomSchemaModule {}
