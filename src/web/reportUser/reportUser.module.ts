import { Module } from '@nestjs/common';
import { UserSchemaModule } from 'src/schemas/user/user.module';
import { ReportUserGateway } from './reportUser.gateway';
import { ReportUserService } from './reportUser.service';
import { ReportUserSchemaModule } from 'src/schemas/reportUser/reportUser.module';

@Module({
  imports: [UserSchemaModule, ReportUserSchemaModule],
  providers: [ReportUserGateway, ReportUserService],
})
export class ReportUserModule {}
