import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { RedisService } from '../../common/redis/redis.service';
import { SettingsService } from '../../settings/settings.service';
import { KvWebhookPayload } from '../kiotviet/dto/kiotviet.dto';
import { SYNC_QUEUE_NAME, SyncJobData } from '../sync/sync.service';
import { verifyHubSignature } from './hmac.util';

function actionToEntity(action: string): string | null {
  const a = action.toLowerCase();
  if (a.startsWith('customer.')) return 'customer';
  if (a.startsWith('order.')) return 'order';
  if (a.startsWith('invoice.')) return 'invoice';
  if (a.startsWith('product.')) return 'product';
  if (a.startsWith('stock.')) return 'product';
  return null;
}

const RECENT_WEBHOOKS_KEY = 'webhook:kiotviet:recent';
const RECENT_LIMIT = 100;
const RECENT_TTL_SEC = 24 * 60 * 60; // 1 ngày

export interface WebhookLogEntry {
  at: string; // ISO timestamp
  id: string;
  attempt: number;
  actions: string[];
  entitiesEnqueued: string[];
  verified: boolean;
  sizeBytes: number;
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly settings: SettingsService,
    private readonly redis: RedisService,
    @InjectQueue(SYNC_QUEUE_NAME) private readonly syncQueue: Queue<SyncJobData>,
  ) {}

  verifySignature(rawBody: Buffer, signature: string | undefined): boolean {
    const secret = this.settings.getKiotVietConfig().webhookSecret;
    if (!secret) {
      this.logger.warn('webhookSecret not set — skipping signature verification');
      return false;
    }
    if (!verifyHubSignature(rawBody, secret, signature)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
    return true;
  }

  async handle(
    payload: KvWebhookPayload,
    rawSize = 0,
    verified = false,
  ): Promise<{ enqueued: string[] }> {
    const entities = new Set<string>();
    const actions: string[] = [];
    for (const notif of payload.Notifications ?? []) {
      actions.push(notif.Action);
      const entity = actionToEntity(notif.Action);
      if (entity) entities.add(entity);
    }

    for (const entity of entities) {
      await this.syncQueue.add(
        entity,
        { entity },
        {
          jobId: `webhook-${entity}-${payload.Id}`,
          attempts: 2,
          backoff: { type: 'exponential', delay: 5_000 },
          removeOnComplete: 100,
          removeOnFail: 200,
        },
      );
    }

    this.logger.log(
      `webhook id=${payload.Id} attempt=${payload.Attempt} actions=[${actions.join(',')}] → enqueued: ${[...entities].join(',') || '(none)'}`,
    );

    // Ring buffer — lưu 100 sự kiện gần nhất để debug
    await this.recordLog({
      at: new Date().toISOString(),
      id: payload.Id,
      attempt: payload.Attempt,
      actions,
      entitiesEnqueued: [...entities],
      verified,
      sizeBytes: rawSize,
    });

    return { enqueued: [...entities] };
  }

  private async recordLog(entry: WebhookLogEntry): Promise<void> {
    try {
      const client = this.redis.client;
      await client
        .multi()
        .lpush(RECENT_WEBHOOKS_KEY, JSON.stringify(entry))
        .ltrim(RECENT_WEBHOOKS_KEY, 0, RECENT_LIMIT - 1)
        .expire(RECENT_WEBHOOKS_KEY, RECENT_TTL_SEC)
        .exec();
    } catch (err) {
      this.logger.warn(`recordLog failed: ${(err as Error).message}`);
    }
  }

  async recentLogs(limit = 50): Promise<WebhookLogEntry[]> {
    const rows = await this.redis.client.lrange(RECENT_WEBHOOKS_KEY, 0, Math.max(0, limit - 1));
    return rows
      .map((r) => {
        try {
          return JSON.parse(r) as WebhookLogEntry;
        } catch {
          return null;
        }
      })
      .filter((x): x is WebhookLogEntry => !!x);
  }
}
