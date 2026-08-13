import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { MatchmakingQueueService } from '../src/common/redis/matchmaking-queue.service';
import { RedisService } from '../src/common/redis/redis.service';

async function run() {
  console.log('Bootstrapping NestJS application context...');
  const app = await NestFactory.createApplicationContext(AppModule);
  const queueService = app.get(MatchmakingQueueService);
  const redisService = app.get(RedisService);
  const client = redisService.getClient();

  console.log('Clearing existing test Redis keys...');
  const keys = await client.keys('queue:*');
  if (keys.length > 0) await client.del(...keys);
  const metaKeys = await client.keys('user:meta:*');
  if (metaKeys.length > 0) await client.del(...metaKeys);

  console.log('Adding users to queue...');
  
  // User 1: No tags
  await queueService.addToQueue('user-1', 'socket-1', { moduleType: 'chat' });

  // User 2: Tag "gaming"
  await queueService.addToQueue('user-2', 'socket-2', { moduleType: 'chat', tags: ['gaming'] });

  // User 3: Tag "music"
  await queueService.addToQueue('user-3', 'socket-3', { moduleType: 'chat', tags: ['music'] });

  // User 4: Tag "gaming" (should match with User 2)
  await queueService.addToQueue('user-4', 'socket-4', { moduleType: 'chat', tags: ['gaming'] });

  console.log('Finding match for user-4 with tag filter...');
  const matchFor4 = await queueService.findMatch('user-4', { moduleType: 'chat', tags: ['gaming'] });
  console.log('Result for user-4:', matchFor4);
  if (matchFor4 && matchFor4.userId === 'user-2') {
    console.log('✅ Tag matching succeeded! User 4 matched with User 2.');
  } else {
    console.error('❌ Tag matching failed.');
  }

  console.log('Finding match for user-3 (music) without strict tags...');
  const matchFor3 = await queueService.findMatch('user-3', { moduleType: 'chat' });
  console.log('Result for user-3:', matchFor3);
  if (matchFor3 && matchFor3.userId === 'user-1') {
    console.log('✅ Fallback to general queue succeeded! User 3 matched with User 1.');
  } else {
    console.error('❌ General fallback matching failed.');
  }

  console.log('Cleaning up remaining users...');
  await queueService.removeFromQueue('user-1');
  await queueService.removeFromQueue('user-2');
  await queueService.removeFromQueue('user-3');
  await queueService.removeFromQueue('user-4');

  await app.close();
  console.log('Test completed successfully!');
}

run().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
