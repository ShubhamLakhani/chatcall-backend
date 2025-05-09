import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: ['https://70a6-2401-4900-1c80-ecfa-94d8-de4f-3bdb-8477.ngrok-free.app'], // or use your ngrok domain here
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('Anonymous Chat API')
    .setDescription('API for Anonymous Chat Matching')
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  await app.listen(5001);
  console.log('Server running at http://localhost:5001');
}
bootstrap();
