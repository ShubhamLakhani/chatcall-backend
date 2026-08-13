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

  @Prop({ default: false })
  read: boolean;

  @Prop()
  readAt?: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
