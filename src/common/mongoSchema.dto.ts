import { Prop } from '@nestjs/mongoose';

export class MongoSchema {
  _id?: string;

  /** Creation timestamp */
  @Prop({ type: Date, default: Date.now })
  readonly createdAt?: string;

  /** Latest update timestamp */
  @Prop({ type: Date, default: Date.now })
  readonly updatedAt?: string;
}
