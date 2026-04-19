import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CursorService } from './cursor.service';
import { SyncResult, SyncStrategy } from './strategies/sync-strategy.interface';
import { BranchSyncStrategy } from './strategies/branch.sync';
import { UserSyncStrategy } from './strategies/user.sync';
import { CategorySyncStrategy } from './strategies/category.sync';
import { ProductSyncStrategy } from './strategies/product.sync';
import { CustomerSyncStrategy } from './strategies/customer.sync';
import { OrderSyncStrategy } from './strategies/order.sync';
import { InvoiceSyncStrategy } from './strategies/invoice.sync';

export const SYNC_QUEUE_NAME = 'sync';

export interface SyncJobData {
  entity: string;
}

const PIPELINE_ORDER = [
  'branch',
  'user',
  'category',
  'product',
  'customer',
  'order',
  'invoice',
] as const;

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);
  private readonly map: Map<string, SyncStrategy>;
  /**
   * AbortController đang active cho job hiện chạy. Key = entity. Processor
   * register khi bắt đầu, unregister khi xong. Stop endpoint abort tất cả.
   */
  private readonly activeControllers = new Map<string, AbortController>();

  constructor(
    @InjectQueue(SYNC_QUEUE_NAME) private readonly queue: Queue<SyncJobData>,
    public readonly cursor: CursorService,
    branch: BranchSyncStrategy,
    user: UserSyncStrategy,
    category: CategorySyncStrategy,
    product: ProductSyncStrategy,
    customer: CustomerSyncStrategy,
    order: OrderSyncStrategy,
    invoice: InvoiceSyncStrategy,
  ) {
    this.map = new Map<string, SyncStrategy>([
      [branch.entity, branch],
      [user.entity, user],
      [category.entity, category],
      [product.entity, product],
      [customer.entity, customer],
      [order.entity, order],
      [invoice.entity, invoice],
    ]);
  }

  entities(): string[] {
    return [...PIPELINE_ORDER];
  }

  getStrategy(entity: string): SyncStrategy {
    const s = this.map.get(entity);
    if (!s) throw new BadRequestException(`Unknown sync entity: ${entity}`);
    return s;
  }

  /** Chạy 1 strategy với abort signal. Processor call. */
  runOne(entity: string, signal?: AbortSignal): Promise<SyncResult> {
    return this.getStrategy(entity).run(signal);
  }

  /** Register AbortController khi job bắt đầu — stopAll sẽ gọi abort. */
  registerActive(entity: string, controller: AbortController): void {
    this.activeControllers.set(entity, controller);
  }

  unregisterActive(entity: string): void {
    this.activeControllers.delete(entity);
  }

  async enqueuePipeline(): Promise<void> {
    const ts = Date.now();
    for (const entity of PIPELINE_ORDER) {
      await this.queue.add(
        entity,
        { entity },
        {
          jobId: `sync-${entity}-${ts}`,
          attempts: 2,
          backoff: { type: 'exponential', delay: 10_000 },
          removeOnComplete: 50,
          removeOnFail: 100,
        },
      );
    }
    this.logger.log('→ sync pipeline enqueued');
  }

  async enqueueOne(entity: string): Promise<void> {
    this.getStrategy(entity);
    await this.queue.add(
      entity,
      { entity },
      {
        jobId: `sync-${entity}-${Date.now()}`,
        attempts: 2,
        backoff: { type: 'exponential', delay: 10_000 },
        removeOnComplete: 50,
        removeOnFail: 100,
      },
    );
  }

  /**
   * Stop all: pause queue + abort running + xoá pending.
   * Queue bị pause — cron không chạy nữa, phải Resume mới tiếp.
   */
  async stopAll(): Promise<{ paused: boolean; removed: number; aborted: number }> {
    await this.queue.pause();
    const aborted = this.activeControllers.size;
    for (const c of this.activeControllers.values()) c.abort();
    const waiting = await this.queue.getJobs(['waiting', 'delayed', 'paused']);
    for (const j of waiting) {
      try {
        await j.remove();
      } catch {
        // Ignore — job đã chuyển trạng thái
      }
    }
    this.logger.warn(
      `sync stop: paused queue, aborted ${aborted} running, removed ${waiting.length} pending`,
    );
    return { paused: true, removed: waiting.length, aborted };
  }

  /**
   * Cancel all: abort running + xoá pending, **không pause queue** — cron + manual
   * tiếp tục hoạt động. Dùng khi chỉ muốn huỷ batch hiện tại.
   */
  async cancelAll(): Promise<{ removed: number; aborted: number }> {
    const aborted = this.activeControllers.size;
    for (const c of this.activeControllers.values()) c.abort();
    const waiting = await this.queue.getJobs(['waiting', 'delayed']);
    for (const j of waiting) {
      try {
        await j.remove();
      } catch {
        // Ignore
      }
    }
    this.logger.warn(
      `sync cancelAll: aborted ${aborted} running, removed ${waiting.length} pending`,
    );
    return { removed: waiting.length, aborted };
  }

  /**
   * Cancel 1 entity:
   *  - Nếu active → abort controller → strategy throw SyncCancelledError ở checkpoint kế
   *  - Nếu waiting/delayed → remove khỏi queue
   */
  async cancelEntity(entity: string): Promise<{ aborted: boolean; removed: number }> {
    this.getStrategy(entity);

    let abortedFlag = false;
    const ctrl = this.activeControllers.get(entity);
    if (ctrl) {
      ctrl.abort();
      abortedFlag = true;
    }

    const [waiting, delayed] = await Promise.all([
      this.queue.getJobs(['waiting']),
      this.queue.getJobs(['delayed']),
    ]);
    const targets = [...waiting, ...delayed].filter((j) => j.data.entity === entity);
    for (const j of targets) {
      try {
        await j.remove();
      } catch {
        // Ignore
      }
    }
    this.logger.warn(
      `sync cancelEntity=${entity}: aborted=${abortedFlag} removed=${targets.length}`,
    );
    return { aborted: abortedFlag, removed: targets.length };
  }

  /** Clear checkpoint của 1 entity — force fresh sync lần sau. */
  async resetCheckpoint(entity: string): Promise<void> {
    this.getStrategy(entity);
    await this.cursor.clearCheckpoint(entity);
  }

  /** Reset full: clear lastSyncedAt + checkpoint. Lần sync kế tiếp = full pull. */
  async resetCursor(entity: string): Promise<void> {
    this.getStrategy(entity);
    await this.cursor.resetCursor(entity);
  }

  /**
   * Reset full cho TẤT CẢ 7 entity. Lần pipeline kế tiếp pull toàn bộ data
   * từ KV (epoch). Upsert → data CRM-native (tags, attributes, ...) giữ nguyên.
   */
  async resetAllCursors(): Promise<{ reset: string[] }> {
    const entities = this.entities();
    for (const e of entities) await this.cursor.resetCursor(e);
    this.logger.warn(`→ reset full all cursors: ${entities.join(',')}`);
    return { reset: entities };
  }

  async resumeAll(): Promise<void> {
    await this.queue.resume();
    this.logger.log('sync resumed');
  }

  /**
   * Pause soft: `queue.pause()` không abort running. Job hiện tại tiếp tục
   * tới xong; job mới ngồi queue đến khi resume. Cron tick vào queue paused
   * → BullMQ bỏ qua. Dùng cho toggle Switch.
   */
  async pauseQueue(): Promise<void> {
    await this.queue.pause();
    this.logger.log('queue paused (soft)');
  }

  async isPaused(): Promise<boolean> {
    return this.queue.isPaused();
  }

  /**
   * Trạng thái từng entity trong BullMQ:
   *  - 'active'   — đang được worker xử lý (chỉ 1 entity tại 1 thời điểm do concurrency=1)
   *  - 'waiting'  — job ngồi queue chờ tới lượt
   *  - 'delayed'  — fail rồi, đang chờ backoff trước khi retry
   *
   * Ưu tiên active > delayed > waiting khi 1 entity có nhiều job (ví dụ pipeline
   * đẩy job mới trong khi job cũ đang retry). Entity không có job nào pending → undefined.
   */
  async getQueueStates(): Promise<Record<string, 'active' | 'waiting' | 'delayed'>> {
    const [active, waiting, delayed] = await Promise.all([
      this.queue.getActive(),
      this.queue.getWaiting(),
      this.queue.getDelayed(),
    ]);
    const map: Record<string, 'active' | 'waiting' | 'delayed'> = {};
    for (const j of active) map[j.data.entity] = 'active';
    for (const j of delayed) if (!map[j.data.entity]) map[j.data.entity] = 'delayed';
    for (const j of waiting) if (!map[j.data.entity]) map[j.data.entity] = 'waiting';
    return map;
  }
}
