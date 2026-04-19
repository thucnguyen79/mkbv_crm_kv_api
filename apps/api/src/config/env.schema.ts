import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  API_PORT: Joi.number().default(3000),
  LOG_LEVEL: Joi.string().valid('fatal', 'error', 'warn', 'info', 'debug', 'trace').default('info'),
  CORS_ORIGINS: Joi.string().default('http://localhost:3001'),

  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgresql', 'postgres'] })
    .required(),

  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').default(''),

  JWT_ACCESS_SECRET: Joi.string().min(16).required(),
  JWT_REFRESH_SECRET: Joi.string().min(16).required(),
  JWT_ACCESS_TTL: Joi.string().default('15m'),
  JWT_REFRESH_TTL: Joi.string().default('7d'),

  // KiotViet — required at runtime to call API but allowed empty in dev scaffolding
  KIOTVIET_RETAILER: Joi.string().allow('').default(''),
  KIOTVIET_CLIENT_ID: Joi.string().allow('').default(''),
  KIOTVIET_CLIENT_SECRET: Joi.string().allow('').default(''),
  KIOTVIET_BASE_URL: Joi.string().uri().default('https://public.kiotapi.com'),
  KIOTVIET_TOKEN_URL: Joi.string().uri().default('https://id.kiotviet.vn/connect/token'),
  KIOTVIET_SCOPE: Joi.string().default('PublicApi.Access'),
  KIOTVIET_WEBHOOK_SECRET: Joi.string().allow('').default(''),

  SYNC_ENABLED: Joi.boolean().default(true),
  SYNC_CRON: Joi.string().default('*/5 * * * *'),

  MESSAGING_DEFAULT_PROVIDER: Joi.string().default('stub'),
  ZNS_PROVIDER: Joi.string().default('stub'),
  SMS_PROVIDER: Joi.string().default('stub'),

  // Loyalty: tier xét theo lifetime points (không phải VND).
  // Điểm tính từ hóa đơn: `1 điểm / LOYALTY_POINT_PER_VND đồng`.
  LOYALTY_POINT_PER_VND: Joi.number().positive().default(10_000),
  LOYALTY_TIER_MEMBER: Joi.number().default(300),
  LOYALTY_TIER_SILVER: Joi.number().default(1_000),
  LOYALTY_TIER_TITAN: Joi.number().default(2_500),
  LOYALTY_TIER_GOLD: Joi.number().default(5_000),
  LOYALTY_TIER_PLATINUM: Joi.number().default(10_000),

  // Inventory
  UPLOAD_DIR: Joi.string().default('./uploads'),
  INVENTORY_LEAD_TIME_DAYS: Joi.number().default(7),
  INVENTORY_SAFETY_DAYS: Joi.number().default(3),
  INVENTORY_FAST_MOVER_DAILY: Joi.number().default(1), // > 1 unit/day = FAST
  INVENTORY_SLOW_MOVER_DAILY: Joi.number().default(0.1), // < 0.1 unit/day = SLOW
  INVENTORY_DEAD_AGING_DAYS: Joi.number().default(60), // tồn > N ngày không bán = DEAD
  INVENTORY_VELOCITY_WINDOW_DAYS: Joi.number().default(30),
  INVENTORY_VELOCITY_CRON: Joi.string().default('0 2 * * *'),
  INVENTORY_LOW_STOCK_CRON: Joi.string().default('0 8 * * *'),
});
