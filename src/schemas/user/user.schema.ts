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

  @Prop({ type: Boolean, default: false })
  isShadowbanned: boolean;

  @Prop({ type: Number, default: 100 })
  reputationScore: number;

  @Prop({ type: Number, default: 100 })
  coins: number;

  @Prop({ type: Number, default: 0 })
  streakCount: number;

  @Prop({ type: [String], default: [] })
  friends: string[];

  @Prop({ type: [String], default: [] })
  friendRequests: string[];

  @Prop({ type: String })
  email: string;

  @Prop({ type: String })
  password: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
