import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { KiotVietService } from '../../kiotviet/kiotviet.service';
import { CursorService } from '../cursor.service';
import { SyncCancelledError, SyncResult, SyncStrategy } from './sync-strategy.interface';
import { KvProduct } from '../../kiotviet/dto/kiotviet.dto';
import { chunkedBatch, SOFT_DELETE_CHUNK } from '../chunk.util';

const PAGE_SIZE = 100;

@Injectable()
export class ProductSyncStrategy implements SyncStrategy {
  readonly entity = 'product';
  private readonly logger = new Logger(ProductSyncStrategy.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kv: KiotVietService,
    private readonly cursor: CursorService,
  ) {}

  async run(signal?: AbortSignal): Promise<SyncResult> {
    const startedAt = new Date();
    const resume = await this.cursor.getResumeState(this.entity);
    await this.cursor.markRunning(this.entity, resume.since);
    if (resume.isResume) {
      this.logger.log(`↺ resuming product from offset=${resume.offset}`);
    }

    try {
      let currentItem = resume.offset;
      let synced = 0;
      let stockRecords = 0;

      while (true) {
        if (signal?.aborted) {
          await this.cursor.markCancelled(this.entity);
          throw new SyncCancelledError();
        }
        const { data, total, removedIds } = await this.kv.products.list(
          {
            currentItem,
            pageSize: PAGE_SIZE,
            lastModifiedFrom: resume.since.toISOString(),
          },
          { signal },
        );
        // Product deleted ở KV → mark isActive=false. Không xoá hẳn để giữ
        // lịch sử trong OrderItem (productId FK).
        if (removedIds?.length) {
          const affected = await chunkedBatch(removedIds, SOFT_DELETE_CHUNK, (batch) =>
            this.prisma.product.updateMany({
              where: {
                externalId: { in: batch.map((n) => BigInt(n)) },
                isActive: true,
              },
              data: { isActive: false },
            }),
          );
          this.logger.log(`↓ deactivated ${affected}/${removedIds.length} product(s)`);
        }
        if (!data.length) break;

        const catExtIds = Array.from(
          new Set(data.map((p) => p.categoryId).filter((x): x is number => !!x)),
        );
        const cats = catExtIds.length
          ? await this.prisma.category.findMany({
              where: { externalId: { in: catExtIds.map((n) => BigInt(n)) } },
              select: { id: true, externalId: true },
            })
          : [];
        const catMap = new Map(cats.map((c) => [Number(c.externalId), c.id]));

        const branchExtIds = Array.from(
          new Set(
            data
              .flatMap((p) => p.inventories ?? [])
              .map((i) => i.branchId)
              .filter((x): x is number => !!x),
          ),
        );
        const branches = branchExtIds.length
          ? await this.prisma.branch.findMany({
              where: { externalId: { in: branchExtIds.map((n) => BigInt(n)) } },
              select: { id: true, externalId: true },
            })
          : [];
        const branchMap = new Map(branches.map((b) => [Number(b.externalId), b.id]));

        for (const p of data) {
          const product = await this.upsertProduct(p, catMap);
          stockRecords += await this.syncStocks(product.id, p, branchMap);
          synced++;
        }
        currentItem += data.length;
        await this.cursor.updateCheckpoint(this.entity, currentItem);
        if (currentItem >= total) break;
      }

      await this.cursor.markSuccess(
        this.entity,
        startedAt,
        `synced=${synced} stockRecords=${stockRecords}`,
      );
      this.logger.log(`✓ products synced: ${synced} (stock records: ${stockRecords})`);
      return { entity: this.entity, synced, lastSyncedAt: startedAt };
    } catch (err) {
      if ((err as Error).name !== 'SyncCancelledError') {
        await this.cursor.markFailed(this.entity, (err as Error).message);
      }
      throw err;
    }
  }

  private async upsertProduct(p: KvProduct, catMap: Map<number, number>) {
    const baseData = {
      externalId: BigInt(p.id),
      code: p.code,
      name: p.name,
      basePrice: p.basePrice ?? 0,
      costPrice: p.cost ?? 0,
      barcode: p.barcode || null,
      description: p.description || null,
      isActive: p.isActive ?? true,
      categoryId: p.categoryId ? (catMap.get(p.categoryId) ?? null) : null,
      masterProductId: p.masterProductId ? BigInt(p.masterProductId) : null,
      masterCode: p.masterCode || null,
    };
    return this.prisma.product.upsert({
      where: { externalId: baseData.externalId },
      create: baseData,
      update: baseData,
    });
  }

  private async syncStocks(
    productId: number,
    p: KvProduct,
    branchMap: Map<number, number>,
  ): Promise<number> {
    if (!p.inventories?.length) return 0;
    const now = new Date();
    let count = 0;
    for (const inv of p.inventories) {
      const branchId = branchMap.get(inv.branchId);
      if (!branchId) continue;
      const existing = await this.prisma.productStock.findUnique({
        where: { productId_branchId: { productId, branchId } },
        select: { onHand: true, lastStockIncreaseAt: true },
      });
      const previousOnHand = existing?.onHand ?? 0;
      const increased = inv.onHand > previousOnHand;

      await this.prisma.productStock.upsert({
        where: { productId_branchId: { productId, branchId } },
        create: {
          productId,
          branchId,
          onHand: inv.onHand,
          reserved: inv.reserved ?? 0,
          lastStockIncreaseAt: inv.onHand > 0 ? now : null,
          lastKvSyncedAt: now,
        },
        update: {
          onHand: inv.onHand,
          reserved: inv.reserved ?? 0,
          lastStockIncreaseAt: increased ? now : existing?.lastStockIncreaseAt,
          lastKvSyncedAt: now,
        },
      });
      count++;
    }
    return count;
  }
}
