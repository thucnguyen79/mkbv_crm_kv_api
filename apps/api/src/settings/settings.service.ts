import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Setting } from '@prisma/client';
import * as crypto from 'node:crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { AppConfig } from '../config/app.config';

/**
 * Các key chuẩn. UI chỉ cho chỉnh những key này.
 * Secret keys được mã hóa AES-256-GCM với JWT_ACCESS_SECRET làm seed.
 */
export const SETTING_KEYS = {
  // KiotViet API (OAuth2)
  KIOTVIET_RETAILER: 'kiotviet.retailer',
  KIOTVIET_CLIENT_ID: 'kiotviet.clientId',
  KIOTVIET_CLIENT_SECRET: 'kiotviet.clientSecret',
  KIOTVIET_BASE_URL: 'kiotviet.baseUrl',
  KIOTVIET_TOKEN_URL: 'kiotviet.tokenUrl',
  KIOTVIET_SCOPE: 'kiotviet.scope',
  // KiotViet Webhook
  KIOTVIET_WEBHOOK_SECRET: 'kiotviet.webhookSecret',
  // SMS provider
  SMS_PROVIDER: 'sms.provider',
  SMS_API_KEY: 'sms.apiKey',
  SMS_API_SECRET: 'sms.apiSecret',
  SMS_SENDER_NAME: 'sms.senderName',
  // ZNS provider (Zalo Notification Service — template đã duyệt)
  ZNS_PROVIDER: 'zns.provider',
  ZNS_API_KEY: 'zns.apiKey',
  ZNS_API_SECRET: 'zns.apiSecret',
  ZNS_OA_ID: 'zns.oaId',
  // Zalo OA provider (tin chăm sóc, chat 2 chiều, 48h session)
  ZALO_OA_PROVIDER: 'zalo_oa.provider',
  ZALO_OA_ACCESS_TOKEN: 'zalo_oa.accessToken',
  ZALO_OA_REFRESH_TOKEN: 'zalo_oa.refreshToken',
  ZALO_OA_ID: 'zalo_oa.oaId',
  ZALO_OA_APP_ID: 'zalo_oa.appId',
} as const;

const SECRET_KEYS = new Set<string>([
  SETTING_KEYS.KIOTVIET_CLIENT_SECRET,
  SETTING_KEYS.KIOTVIET_WEBHOOK_SECRET,
  SETTING_KEYS.SMS_API_KEY,
  SETTING_KEYS.SMS_API_SECRET,
  SETTING_KEYS.ZNS_API_KEY,
  SETTING_KEYS.ZNS_API_SECRET,
  SETTING_KEYS.ZALO_OA_ACCESS_TOKEN,
  SETTING_KEYS.ZALO_OA_REFRESH_TOKEN,
]);

export interface KiotVietConfig {
  retailer: string;
  clientId: string;
  clientSecret: string;
  baseUrl: string;
  tokenUrl: string;
  scope: string;
  webhookSecret: string;
}

/**
 * Cache in-memory. Invalidate khi `set()`.
 * Giả định: 1 instance API (hoặc deploy mới chấp nhận delay 1 request).
 * Multi-instance → cần pub/sub Redis; tạm thời đủ cho 1 VPS single-node.
 */
@Injectable()
export class SettingsService implements OnModuleInit {
  private readonly logger = new Logger(SettingsService.name);
  private readonly cache = new Map<string, string | null>();
  private readonly cipherKey: Buffer;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cfg: AppConfig,
  ) {
    // Dùng SHA-256 của JWT access secret làm encryption key (32 bytes AES-256).
    // Không ideal cho security thuần (shared purpose); nếu cần riêng, thêm SETTINGS_SECRET env.
    this.cipherKey = crypto.createHash('sha256').update(this.cfg.jwt.accessSecret).digest();
  }

  async onModuleInit(): Promise<void> {
    const rows = await this.prisma.setting.findMany();
    for (const r of rows) this.cache.set(r.key, this.decryptIfNeeded(r));
    this.logger.log(`Settings loaded: ${rows.length} key(s) cached`);
  }

  /** Lấy giá trị: DB first, fallback env (qua `envFallback`). */
  get(key: string, envFallback?: string): string {
    const cached = this.cache.get(key);
    if (cached !== undefined && cached !== null && cached !== '') return cached;
    return envFallback ?? '';
  }

  async set(key: string, value: string, updatedById?: number): Promise<void> {
    const encrypted = SECRET_KEYS.has(key);
    const storedValue = encrypted && value ? this.encrypt(value) : value;
    await this.prisma.setting.upsert({
      where: { key },
      create: {
        key,
        value: storedValue,
        encrypted,
        updatedById: updatedById ?? null,
      },
      update: {
        value: storedValue,
        encrypted,
        updatedById: updatedById ?? null,
      },
    });
    this.cache.set(key, value);
    this.logger.log(`Setting updated: ${key} (encrypted=${encrypted})`);
  }

  async remove(key: string): Promise<void> {
    await this.prisma.setting.deleteMany({ where: { key } });
    this.cache.delete(key);
  }

  /** List all settings for UI (secrets masked). */
  async listAll(): Promise<
    Array<{
      key: string;
      value: string;
      masked: boolean;
      updatedAt: Date | null;
      source: 'db' | 'env' | 'none';
    }>
  > {
    const rows = await this.prisma.setting.findMany();
    const byKey = new Map(rows.map((r) => [r.key, r]));

    const result: Array<{
      key: string;
      value: string;
      masked: boolean;
      updatedAt: Date | null;
      source: 'db' | 'env' | 'none';
    }> = [];
    for (const key of Object.values(SETTING_KEYS)) {
      const row = byKey.get(key);
      const envVal = this.envValueForKey(key);
      const isSecret = SECRET_KEYS.has(key);
      if (row) {
        const raw = this.decryptIfNeeded(row);
        result.push({
          key,
          value: isSecret ? maskSecret(raw) : raw,
          masked: isSecret,
          updatedAt: row.updatedAt,
          source: 'db',
        });
      } else if (envVal) {
        result.push({
          key,
          value: isSecret ? maskSecret(envVal) : envVal,
          masked: isSecret,
          updatedAt: null,
          source: 'env',
        });
      } else {
        result.push({ key, value: '', masked: isSecret, updatedAt: null, source: 'none' });
      }
    }
    return result;
  }

  /** Tiện: trả config KiotViet đã merge DB + env fallback. */
  getKiotVietConfig(): KiotVietConfig {
    const env = this.cfg.kiotviet;
    return {
      retailer: this.get(SETTING_KEYS.KIOTVIET_RETAILER, env.retailer),
      clientId: this.get(SETTING_KEYS.KIOTVIET_CLIENT_ID, env.clientId),
      clientSecret: this.get(SETTING_KEYS.KIOTVIET_CLIENT_SECRET, env.clientSecret),
      baseUrl: this.get(SETTING_KEYS.KIOTVIET_BASE_URL, env.baseUrl),
      tokenUrl: this.get(SETTING_KEYS.KIOTVIET_TOKEN_URL, env.tokenUrl),
      scope: this.get(SETTING_KEYS.KIOTVIET_SCOPE, env.scope),
      webhookSecret: this.get(SETTING_KEYS.KIOTVIET_WEBHOOK_SECRET, env.webhookSecret),
    };
  }

  private envValueForKey(key: string): string {
    const env = this.cfg.kiotviet;
    switch (key) {
      case SETTING_KEYS.KIOTVIET_RETAILER:
        return env.retailer;
      case SETTING_KEYS.KIOTVIET_CLIENT_ID:
        return env.clientId;
      case SETTING_KEYS.KIOTVIET_CLIENT_SECRET:
        return env.clientSecret;
      case SETTING_KEYS.KIOTVIET_BASE_URL:
        return env.baseUrl;
      case SETTING_KEYS.KIOTVIET_TOKEN_URL:
        return env.tokenUrl;
      case SETTING_KEYS.KIOTVIET_SCOPE:
        return env.scope;
      case SETTING_KEYS.KIOTVIET_WEBHOOK_SECRET:
        return env.webhookSecret;
      default:
        return '';
    }
  }

  // ======= Crypto =======

  private encrypt(plain: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.cipherKey, iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
  }

  private decrypt(payload: string): string {
    const parts = payload.split(':');
    if (parts.length !== 4 || parts[0] !== 'v1') return payload; // chưa encrypt / malformed
    const [, ivB64, tagB64, encB64] = parts;
    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const enc = Buffer.from(encB64, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.cipherKey, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  }

  private decryptIfNeeded(row: Setting): string {
    if (!row.encrypted || !row.value) return row.value;
    try {
      return this.decrypt(row.value);
    } catch (err) {
      this.logger.warn(`decrypt failed for key=${row.key}: ${(err as Error).message}`);
      return '';
    }
  }
}

function maskSecret(v: string): string {
  if (!v) return '';
  if (v.length <= 8) return '••••••••';
  return `${v.slice(0, 4)}••••${v.slice(-4)}`;
}
