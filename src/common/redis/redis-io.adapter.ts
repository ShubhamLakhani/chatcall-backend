import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { INestApplicationContext } from '@nestjs/common';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter>;

  constructor(appOrHttpServer: INestApplicationContext) {
    super(appOrHttpServer);
  }

  async connectToRedis(host: string, port: number, password?: string): Promise<void> {
    const pubClient = new Redis({ host, port, password, maxRetriesPerRequest: null });
    const subClient = pubClient.duplicate();

    await Promise.all([
      new Promise<void>((resolve, reject) => {
        pubClient.once('connect', () => resolve());
        pubClient.once('error', (err) => reject(err));
      }),
      new Promise<void>((resolve, reject) => {
        subClient.once('connect', () => resolve());
        subClient.once('error', (err) => reject(err));
      })
    ]);

    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    server.adapter(this.adapterConstructor);
    return server;
  }
}
