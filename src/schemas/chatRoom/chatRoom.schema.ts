import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { MongoSchema } from 'src/common/mongoSchema.dto';

@Schema()
export class ChatRoom extends MongoSchema {
  @Prop({ required: true })
  user1: string;

  @Prop({ required: true })
  user2: string;
}

export const ChatRoomSchema = SchemaFactory.createForClass(ChatRoom);
