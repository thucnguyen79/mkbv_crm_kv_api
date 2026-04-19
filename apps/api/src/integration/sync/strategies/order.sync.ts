import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrderSource, Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { KiotVietService } from '../../kiotviet/kiotviet.service';
import { LoyaltyService } from '../../../loyalty/loyalty.service';
import { CursorService } from '../cursor.service';
import { SyncCancelledError, SyncResult, SyncStrategy } from './sync-strategy.interface';
import { KvOrder, KvOrderDetail } from '../../kiotviet/dto/kiotviet.dto';
import { chunkedBatch, SOFT_DELETE_CHUNK } from '../chunk.util';
import {
  ORDER_SYNCED_EVENT,
  OrderSyncedEvent,
} from '../../../automation/events/order-synced.event';

const PAGE_SIZE = 100;

/**
 * Sync KiotViet orders → Order (sourceType=ORDER).
 * Also recomputes customer.totalSpent / lastPurchaseAt from the orders touched.
 */
@Injectable()
export class OrderSyncStrategy implements SyncStrategy {
  readonly entity = 'order';
  private readonly logger = new Logger(OrderSyncStrategy.name);

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
      this.logger.log(`↺ resuming order from offset=${resume.offset}`);
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
        const { data, total, removedIds } = await this.kv.orders.list(
          {
            currentItem,
            pageSize: PAGE_SIZE,
            lastModifiedFrom: resume.since.toISOString(),
          },
          { signal },
        );
        // Soft-delete order đã xoá ở KV (sourceType=ORDER để không đụng INVOICE row)
        if (removedIds?.length) {
          const affected = await chunkedBatch(removedIds, SOFT_DELETE_CHUNK, (batch) =>
            this.prisma.order.updateMany({
              where: {
                externalId: { in: batch.map((n) => BigInt(n)) },
                sourceType: OrderSource.ORDER,
                deletedAt: null,
              },
              data: { deletedAt: new Date() },
            }),
          );
          this.logger.log(`↓ soft-deleted ${affected}/${removedIds.length} order(s)`);
        }
        if (!data.length) break;

        for (const o of data) {
          const customerId = await upsertOrderLike(
            this.prisma,
            o,
            OrderSource.ORDER,
            o.orderDetails ?? [],
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
      this.logger.log(`✓ orders synced: ${synced} (loyalty recomputed: ${ids.length})`);
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

/**
 * Shared upsert logic used by both OrderSyncStrategy (sourceType=ORDER) and
 * InvoiceSyncStrategy (sourceType=INVOICE). Resolves customer/branch/product
 * externalIds to local ids and writes items inside a single transaction.
 *
 * Returns the local customerId (if any) so the caller can aggregate totals.
 */
export async function upsertOrderLike(
  prisma: PrismaService,
  kv: KvOrder,
  sourceType: OrderSource,
  details: KvOrderDetail[],
): Promise<number | null> {
  // Resolve foreign keys
  const [customer, branch] = await Promise.all([
    kv.customerId
      ? prisma.customer.findUnique({
          where: { externalId: BigInt(kv.customerId) },
          select: { id: true },
        })
      : Promise.resolve(null),
    kv.branchId
      ? prisma.branch.findUnique({
          where: { externalId: BigInt(kv.branchId) },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);

  const productExtIds = Array.from(new Set(details.map((d) => d.productId).filter(Boolean)));
  const products = productExtIds.length
    ? await prisma.product.findMany({
        where: { externalId: { in: productExtIds.map((n) => BigInt(n)) } },
        select: { id: true, externalId: true },
      })
    : [];
  const productMap = new Map(products.map((p) => [Number(p.externalId), p.id]));

  const baseData = {
    externalId: BigInt(kv.id),
    externalCode: kv.code,
    sourceType,
    customerId: customer?.id ?? null,
    branchId: branch?.id ?? null,
    totalAmount: kv.total,
    discount: kv.discount ?? 0,
    status: String(kv.statusValue ?? kv.status),
    purchasedAt: new Date(kv.purchaseDate),
    raw: kv as unknown as Prisma.InputJsonValue,
  };

  // Upsert order + replace line items in a transaction
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.upsert({
      where: { externalId: baseData.externalId },
      create: baseData,
      update: baseData,
    });
    await tx.orderItem.deleteMany({ where: { orderId: order.id } });
    if (details.length) {
      await tx.orderItem.createMany({
        data: details.map((d) => ({
          orderId: order.id,
          productId: productMap.get(d.productId) ?? null,
          name: d.productName,
          quantity: d.quantity,
          price: d.price,
          discount: d.discount ?? 0,
        })),
      });
    }
  });

  return customer?.id ?? null;
}

/** Recompute totalSpent / lastPurchaseAt for a set of customers from Order table. */
export async function recomputeCustomerTotals(
  prisma: PrismaService,
  customerIds: number[],
): Promise<void> {
  for (const id of customerIds) {
    const agg = await prisma.order.aggregate({
      where: { customerId: id },
      _sum: { totalAmount: true },
      _max: { purchasedAt: true },
    });
    await prisma.customer.update({
      where: { id },
      data: {
        totalSpent: agg._sum.totalAmount ?? 0,
        lastPurchaseAt: agg._max.purchasedAt ?? null,
      },
    });
  }
}
