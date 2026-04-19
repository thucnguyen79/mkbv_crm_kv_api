import { Global, Module } from '@nestjs/common';
import Redis from 'ioredis';
import { AppConfig } from '../../config/app.config';
import { REDIS_CLIENT, RedisService } from './redis.service';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [AppConfig],
      useFactory: (cfg: AppConfig) => {
        const { host, port, password } = cfg.redis;
        return new Redis({
          host,
          port,
          password,
          maxRetriesPerRequest: null, // required by BullMQ workers
          enableReadyCheck: false,
        });
      },
    },
    RedisService,
  ],
  exports: [REDIS_CLIENT, RedisService],
})
export class RedisModule {}
