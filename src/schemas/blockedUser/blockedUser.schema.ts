import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose from 'mongoose';
import { MongoSchema } from 'src/common/mongoSchema.dto';

@Schema({ timestamps: true })
export class BlockedUser extends MongoSchema {
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true })
  blocker: string; /* Block by user */

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true })
  blocked: string; /* Blocked user */
}

export const BlockedUserSchema = SchemaFactory.createForClass(BlockedUser);
