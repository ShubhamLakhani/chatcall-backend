import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { UserSchemaModule } from 'src/schemas/user/user.module';
import { ChatRoomSchemaModule } from 'src/schemas/chatRoom/chatRoom.module';
import { MessageSchemaModule } from 'src/schemas/message/message.module';
import { BlockedUserSchemaModule } from 'src/schemas/blockedUser/blockedUser.module';
import { WebRtcController } from './webrtc.controller';

@Module({
  imports: [UserSchemaModule, ChatRoomSchemaModule, MessageSchemaModule, BlockedUserSchemaModule],
  controllers: [WebRtcController],
  providers: [ChatGateway, ChatService],
})
export class ChatModule {}
