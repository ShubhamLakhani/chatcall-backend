import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const host = this.configService.get<string>('REDIS_HOST') || 'localhost';
    const port = parseInt(this.configService.get<string>('REDIS_PORT') || '6379', 10);
    const password = this.configService.get<string>('REDIS_PASSWORD') || undefined;

    this.logger.log(`Connecting to Redis at ${host}:${port}...`);

    this.client = new Redis({
      host,
      port,
      password,
      maxRetriesPerRequest: null,
    });

    this.client.on('connect', () => {
      this.logger.log('Redis connected successfully.');
    });

    this.client.on('error', (err: any) => {
      this.logger.error('Redis connection error:', err);
    });
  }

  onModuleDestroy() {
    this.logger.log('Disconnecting from Redis...');
    this.client.disconnect();
  }

  getClient(): Redis {
    return this.client;
  }
}
