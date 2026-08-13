import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { WebRtcController } from '../src/web/chat/webrtc.controller';

async function run() {
  console.log('Bootstrapping NestJS application context...');
  const app = await NestFactory.createApplicationContext(AppModule);
  const controller = app.get(WebRtcController);

  console.log('Fetching WebRTC ICE server configurations...');
  const result = await controller.getIceServers();
  console.log('Result:', JSON.stringify(result, null, 2));

  if (result && Array.isArray(result.iceServers) && result.iceServers.length > 0) {
    console.log('✅ WebRtcController verified successfully!');
  } else {
    console.error('❌ WebRtcController verification failed.');
  }

  await app.close();
  console.log('Done!');
}

run().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
