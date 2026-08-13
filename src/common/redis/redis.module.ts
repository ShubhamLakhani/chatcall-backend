import { Module, Global } from '@nestjs/common';
import { RedisService } from './redis.service';
import { MatchmakingQueueService } from './matchmaking-queue.service';

@Global()
@Module({
  providers: [RedisService, MatchmakingQueueService],
  exports: [RedisService, MatchmakingQueueService],
})
export class RedisModule {}
