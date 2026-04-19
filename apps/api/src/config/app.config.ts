import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Typed accessor over ConfigService. Use instead of raw `process.env` / `ConfigService.get`.
 */
@Injectable()
export class AppConfig {
  constructor(private readonly cfg: ConfigService) {}

  get nodeEnv(): 'development' | 'test' | 'production' {
    return this.cfg.getOrThrow('NODE_ENV');
  }

  get apiPort(): number {
    return Number(this.cfg.getOrThrow('API_PORT'));
  }

  get corsOrigins(): string[] {
    return this.cfg.getOrThrow<string>('CORS_ORIGINS').split(',').map((s) => s.trim());
  }

  get databaseUrl(): string {
    return this.cfg.getOrThrow('DATABASE_URL');
  }

  get redis() {
    return {
      host: this.cfg.getOrThrow<string>('REDIS_HOST'),
      port: Number(this.cfg.getOrThrow('REDIS_PORT')),
      password: this.cfg.get<string>('REDIS_PASSWORD') || undefined,
    };
  }

  get jwt() {
    return {
      accessSecret: this.cfg.getOrThrow<string>('JWT_ACCESS_SECRET'),
      refreshSecret: this.cfg.getOrThrow<string>('JWT_REFRESH_SECRET'),
      accessTtl: this.cfg.getOrThrow<string>('JWT_ACCESS_TTL'),
      refreshTtl: this.cfg.getOrThrow<string>('JWT_REFRESH_TTL'),
    };
  }

  get kiotviet() {
    return {
      retailer: this.cfg.get<string>('KIOTVIET_RETAILER') ?? '',
      clientId: this.cfg.get<string>('KIOTVIET_CLIENT_ID') ?? '',
      clientSecret: this.cfg.get<string>('KIOTVIET_CLIENT_SECRET') ?? '',
      baseUrl: this.cfg.getOrThrow<string>('KIOTVIET_BASE_URL'),
      tokenUrl: this.cfg.getOrThrow<string>('KIOTVIET_TOKEN_URL'),
      scope: this.cfg.getOrThrow<string>('KIOTVIET_SCOPE'),
      webhookSecret: this.cfg.get<string>('KIOTVIET_WEBHOOK_SECRET') ?? '',
    };
  }

  get sync() {
    return {
      enabled: this.cfg.get<string>('SYNC_ENABLED') !== 'false',
      cron: this.cfg.getOrThrow<string>('SYNC_CRON'),
    };
  }

  get messaging() {
    return {
      defaultProvider: this.cfg.getOrThrow<string>('MESSAGING_DEFAULT_PROVIDER'),
      znsProvider: this.cfg.getOrThrow<string>('ZNS_PROVIDER'),
      smsProvider: this.cfg.getOrThrow<string>('SMS_PROVIDER'),
    };
  }

  get inventory() {
    return {
      uploadDir: this.cfg.getOrThrow<string>('UPLOAD_DIR'),
      leadTimeDays: Number(this.cfg.getOrThrow('INVENTORY_LEAD_TIME_DAYS')),
      safetyDays: Number(this.cfg.getOrThrow('INVENTORY_SAFETY_DAYS')),
      fastMoverDaily: Number(this.cfg.getOrThrow('INVENTORY_FAST_MOVER_DAILY')),
      slowMoverDaily: Number(this.cfg.getOrThrow('INVENTORY_SLOW_MOVER_DAILY')),
      deadAgingDays: Number(this.cfg.getOrThrow('INVENTORY_DEAD_AGING_DAYS')),
      velocityWindowDays: Number(this.cfg.getOrThrow('INVENTORY_VELOCITY_WINDOW_DAYS')),
      velocityCron: this.cfg.getOrThrow<string>('INVENTORY_VELOCITY_CRON'),
      lowStockCron: this.cfg.getOrThrow<string>('INVENTORY_LOW_STOCK_CRON'),
    };
  }

  get loyalty() {
    return {
      /** VND cần để có 1 điểm (ví dụ 10_000 → chi 10k được 1 điểm). */
      pointPerVnd: Number(this.cfg.getOrThrow('LOYALTY_POINT_PER_VND')),
      memberThreshold: Number(this.cfg.getOrThrow('LOYALTY_TIER_MEMBER')),
      silverThreshold: Number(this.cfg.getOrThrow('LOYALTY_TIER_SILVER')),
      titanThreshold: Number(this.cfg.getOrThrow('LOYALTY_TIER_TITAN')),
      goldThreshold: Number(this.cfg.getOrThrow('LOYALTY_TIER_GOLD')),
      platinumThreshold: Number(this.cfg.getOrThrow('LOYALTY_TIER_PLATINUM')),
    };
  }
}
