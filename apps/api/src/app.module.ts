import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { envValidationSchema } from './config/env.schema';
import { AppConfig } from './config/app.config';
import { AppConfigModule } from './config/config.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { HealthController } from './health/health.controller';
import { MetricsController } from './health/metrics.controller';
import { AuthModule } from './auth/auth.module';
import { IntegrationModule } from './integration/integration.module';
import { CustomerModule } from './customer/customer.module';
import { OrderModule } from './order/order.module';
import { LoyaltyModule } from './loyalty/loyalty.module';
import { MessagingModule } from './messaging/messaging.module';
import { AutomationModule } from './automation/automation.module';
import { InventoryModule } from './inventory/inventory.module';
import { SettingsModule } from './settings/settings.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // .env ở root repo. Dev: cwd = apps/api → lên 2 cấp. Prod docker: /app + mounted /.env.
      envFilePath: ['../../.env', '.env'],
      validationSchema: envValidationSchema,
      validationOptions: { allowUnknown: true, abortEarly: false },
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            '*.password',
            '*.passwordHash',
            '*.accessToken',
            '*.refreshToken',
          ],
          censor: '[REDACTED]',
        },
      },
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    AppConfigModule,
    // Single BullMQ connection shared by all queues (sync, messaging, …)
    BullModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [AppConfig],
      useFactory: (cfg: AppConfig) => ({
        connection: {
          host: cfg.redis.host,
          port: cfg.redis.port,
          password: cfg.redis.password,
        },
      }),
    }),
    PrismaModule,
    RedisModule,
    SettingsModule, // Global — KiotViet services inject SettingsService
    AuthModule,
    LoyaltyModule, // Global — must be imported before IntegrationModule uses LoyaltyService
    IntegrationModule,
    CustomerModule,
    OrderModule,
    MessagingModule,
    AutomationModule,
    InventoryModule,
    UsersModule,
    RolesModule,
  ],
  controllers: [HealthController, MetricsController],
})
export class AppModule {}
