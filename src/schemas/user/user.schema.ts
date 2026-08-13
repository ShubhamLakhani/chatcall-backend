import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { MongoSchema } from 'src/common/mongoSchema.dto';
import { ModuleType } from 'src/enums';

@Schema()
export class User extends MongoSchema {
  @Prop({ type: String })
  socketId: string;

  @Prop({ type: Boolean, default: false })
  isMatched: boolean;

  @Prop({ type: String, default: null })
  deviceId: string;

  @Prop({ type: String, default: ModuleType.chat })
  moduleType: ModuleType;

  @Prop({ type: String })
  email: string;

  @Prop({ type: String })
  password: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
