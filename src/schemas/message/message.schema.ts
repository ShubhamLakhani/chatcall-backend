import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { MongoSchema } from 'src/common/mongoSchema.dto';

@Schema({ timestamps: true })
export class Message extends MongoSchema {
  @Prop()
  sender: string;

  @Prop()
  receiver: string;

  @Prop()
  content: string;

  @Prop()
  chatRoomId: string;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
