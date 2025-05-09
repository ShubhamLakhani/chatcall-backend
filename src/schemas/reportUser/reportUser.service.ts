import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ReportUser } from './reportUser.schema';

@Injectable()
export class ReportUserModelService {
  constructor(
    @InjectModel(ReportUser.name)
    private readonly reportUserModel: Model<ReportUser>,
  ) {}

  createReportUser(value: ReportUser): Promise<ReportUser> {
    return this.reportUserModel.create(value);
  }
}
