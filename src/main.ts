import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { RedisIoAdapter } from './common/redis/redis-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: 'http://localhost:3000', // Allow all origins or specify your domain(s) here
    credentials: true,
  });

  app.setGlobalPrefix('api');

  // Configure Redis Socket Adapter
  const configService = app.get(ConfigService);
  const redisHost = configService.get<string>('REDIS_HOST') || 'localhost';
  const redisPort = parseInt(configService.get<string>('REDIS_PORT') || '6379', 10);
  const redisPassword = configService.get<string>('REDIS_PASSWORD');

  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis(redisHost, redisPort, redisPassword);
  app.useWebSocketAdapter(redisIoAdapter);

  const config = new DocumentBuilder()
    .setTitle('Anonymous Chat API')
    .setDescription('API for Anonymous Chat Matching')
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  await app.listen(3001);
}
bootstrap();
