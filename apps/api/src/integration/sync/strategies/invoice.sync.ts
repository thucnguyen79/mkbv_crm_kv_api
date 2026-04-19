import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrderSource } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { KiotVietService } from '../../kiotviet/kiotviet.service';
import { LoyaltyService } from '../../../loyalty/loyalty.service';
import { CursorService } from '../cursor.service';
import { SyncCancelledError, SyncResult, SyncStrategy } from './sync-strategy.interface';
import { recomputeCustomerTotals, upsertOrderLike } from './order.sync';
import { chunkedBatch, SOFT_DELETE_CHUNK } from '../chunk.util';
import {
  ORDER_SYNCED_EVENT,
  OrderSyncedEvent,
} from '../../../automation/events/order-synced.event';

const PAGE_SIZE = 100;

@Injectable()
export class InvoiceSyncStrategy implements SyncStrategy {
  readonly entity = 'invoice';
  private readonly logger = new Logger(InvoiceSyncStrategy.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kv: KiotVietService,
    private readonly cursor: CursorService,
    private readonly loyalty: LoyaltyService,
    private readonly events: EventEmitter2,
  ) {}

  async run(signal?: AbortSignal): Promise<SyncResult> {
    const startedAt = new Date();
    const resume = await this.cursor.getResumeState(this.entity);
    await this.cursor.markRunning(this.entity, resume.since);
    if (resume.isResume) {
      this.logger.log(`↺ resuming invoice from offset=${resume.offset}`);
    }

    try {
      let currentItem = resume.offset;
      let synced = 0;
      const touchedCustomerIds = new Set<number>();

      while (true) {
        if (signal?.aborted) {
          await this.cursor.markCancelled(this.entity);
          throw new SyncCancelledError();
        }
        const { data, total, removedIds } = await this.kv.invoices.list(
          {
            currentItem,
            pageSize: PAGE_SIZE,
            lastModifiedFrom: resume.since.toISOString(),
          },
          { signal },
        );
        // Soft-delete invoice đã xoá ở KV (sourceType=INVOICE)
        if (removedIds?.length) {
          const affected = await chunkedBatch(removedIds, SOFT_DELETE_CHUNK, (batch) =>
            this.prisma.order.updateMany({
              where: {
                externalId: { in: batch.map((n) => BigInt(n)) },
                sourceType: OrderSource.INVOICE,
                deletedAt: null,
              },
              data: { deletedAt: new Date() },
            }),
          );
          this.logger.log(`↓ soft-deleted ${affected}/${removedIds.length} invoice(s)`);
        }
        if (!data.length) break;

        for (const inv of data) {
          const customerId = await upsertOrderLike(
            this.prisma,
            inv,
            OrderSource.INVOICE,
            inv.invoiceDetails ?? [],
          );
          if (customerId) touchedCustomerIds.add(customerId);
          synced++;
        }
        currentItem += data.length;
        await this.cursor.updateCheckpoint(this.entity, currentItem);
        if (currentItem >= total) break;
      }

      const ids = Array.from(touchedCustomerIds);
      await recomputeCustomerTotals(this.prisma, ids);
      await this.loyalty.recalculateBatch(ids);
      await this.cursor.markSuccess(this.entity, startedAt, `synced=${synced}`);
      this.logger.log(`✓ invoices synced: ${synced} (loyalty recomputed: ${ids.length})`);
      if (ids.length) this.events.emit(ORDER_SYNCED_EVENT, new OrderSyncedEvent(ids));
      return { entity: this.entity, synced, lastSyncedAt: startedAt };
    } catch (err) {
      if ((err as Error).name !== 'SyncCancelledError') {
        await this.cursor.markFailed(this.entity, (err as Error).message);
      }
      throw err;
    }
  }
}
