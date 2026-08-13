import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WebModule } from './web/web.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI') || 'mongodb+srv://Avadh:JKXVeHQ24pNJ184d@cluster0.h0vuuxw.mongodb.net/chat-app',
      }),
      inject: [ConfigService],
    }),
    WebModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
