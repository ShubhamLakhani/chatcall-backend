import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WebModule } from './web/web.module';

@Module({
  imports: [
    MongooseModule.forRoot(
      'mongodb+srv://Avadh:JKXVeHQ24pNJ184d@cluster0.h0vuuxw.mongodb.net/chat-app',
    ),
    WebModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
