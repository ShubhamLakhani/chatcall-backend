import { SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { ReportUser } from 'src/schemas/reportUser/reportUser.schema';
import { ReportUserService } from './reportUser.service';

@WebSocketGateway({ cors: true })
export class ReportUserGateway {
  constructor(private readonly reportUserService: ReportUserService) {}

  @SubscribeMessage('report-user')
  onBlockUser(client: Socket, data: ReportUser) {
    console.log('🚀 ~ BlockedUserGateway ~ data:', data);
    return this.reportUserService.reportUser(client, data);
  }
}
