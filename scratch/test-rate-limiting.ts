import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { MatchmakingQueueService } from '../src/common/redis/matchmaking-queue.service';

async function run() {
  console.log('Bootstrapping NestJS application context...');
  const app = await NestFactory.createApplicationContext(AppModule);
  const queueService = app.get(MatchmakingQueueService);

  const userId = 'rate-limit-test-user';
  console.log(`Testing rate limits for user: ${userId}`);

  // Clear rate limits first
  await queueService.clearRateLimit(userId);

  let successCount = 0;
  let rateLimitedCount = 0;

  // Simulate 7 attempts in rapid succession
  for (let i = 1; i <= 7; i++) {
    const isExceeded = await queueService.checkRateLimit(userId);
    console.log(`Attempt ${i}: rateLimitExceeded = ${isExceeded}`);
    if (isExceeded) {
      rateLimitedCount++;
    } else {
      successCount++;
    }
  }

  console.log(`Results: ${successCount} successful calls, ${rateLimitedCount} rate-limited calls.`);

  if (successCount === 5 && rateLimitedCount === 2) {
    console.log('✅ Sliding-window rate limit verified: allowed exactly 5 calls, blocked subsequent calls!');
  } else {
    console.error('❌ Sliding-window rate limit verification failed.');
  }

  // Clear rate limits
  console.log('Clearing rate limits (simulating CAPTCHA solve)...');
  await queueService.clearRateLimit(userId);

  const attemptAfterClear = await queueService.checkRateLimit(userId);
  console.log(`Attempt after clear: rateLimitExceeded = ${attemptAfterClear}`);

  if (attemptAfterClear === false) {
    console.log('✅ CAPTCHA rate limit clearance verified!');
  } else {
    console.error('❌ CAPTCHA rate limit clearance verification failed.');
  }

  await app.close();
  console.log('Done!');
}

run().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
