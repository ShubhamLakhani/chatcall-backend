import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { UserSchemaModule } from 'src/schemas/user/user.module';
import { ChatRoomSchemaModule } from 'src/schemas/chatRoom/chatRoom.module';

@Module({
  imports: [UserSchemaModule, ChatRoomSchemaModule],
  providers: [ChatGateway, ChatService],
})
export class ChatModule {}
