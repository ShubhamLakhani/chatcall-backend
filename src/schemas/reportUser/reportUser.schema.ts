import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import mongoose from 'mongoose';
import { MongoSchema } from 'src/common/mongoSchema.dto';

@Schema({ timestamps: true })
export class ReportUser extends MongoSchema {
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true })
  @ApiProperty({ example: '5f8d9f1d8a1e6c1c4f9d9f1d' })
  reporter: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true })
  @ApiProperty({ example: '5f8d9f1d8a1e6c1c4f9d9f1d' })
  reported: string;

  @Prop({ type: String, required: true })
  @ApiProperty({ example: 'Not a good user' })
  reason: string;

  @Prop({ type: String })
  @ApiProperty({ example: null })
  description?: string;
}

export const ReportUserSchema = SchemaFactory.createForClass(ReportUser);
