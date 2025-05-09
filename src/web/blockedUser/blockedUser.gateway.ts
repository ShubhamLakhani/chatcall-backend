import { SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { BlockedUserService } from './blockedUser.service';

@WebSocketGateway({ cors: true })
export class BlockedUserGateway {
  constructor(private readonly blockedUserService: BlockedUserService) {}

  @SubscribeMessage('block-user')
  async onBlockUser(
    client: Socket,
    data: { userId: string; targetUserId: string },
  ) {
    console.log('🚀 ~ BlockedUserGateway ~ data:', data);
    const responce = await this.blockedUserService.blockUser(
      data.userId,
      data.targetUserId,
    );
    console.log('🚀 ~ BlockedUserGateway ~ responce:', responce);
    client.emit('block-user', responce);
  }
}
