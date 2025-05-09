import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { MongoSchema } from 'src/common/mongoSchema.dto';
import { ModuleType } from 'src/enums';

@Schema()
export class User extends MongoSchema {
  @Prop({ required: true })
  socketId: string;

  @Prop({ default: false })
  isMatched: boolean;

  @Prop({ default: null })
  deviceId: string;

  @Prop({ default: ModuleType.chat })
  moduleType: ModuleType;
}

export const UserSchema = SchemaFactory.createForClass(User);
