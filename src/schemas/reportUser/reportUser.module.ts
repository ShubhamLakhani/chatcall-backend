import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReportUser, ReportUserSchema } from './reportUser.schema';
import { ReportUserModelService } from './reportUser.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ReportUser.name, schema: ReportUserSchema },
    ]),
  ],
  providers: [ReportUserModelService],
  exports: [MongooseModule, ReportUserModelService],
})
export class ReportUserSchemaModule {}
