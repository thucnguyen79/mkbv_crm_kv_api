import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppConfig } from '../../config/app.config';
import { agingDays, computeReorderPoint, computeVelocityTag } from './velocity.util';

interface OrderItemAgg {
  productId: number;
  branchId: number;
  qty: number;
}

/**
 * Tính velocity, reorder point, velocityTag cho mọi (SP×CN) có track tồn.
 * Được gọi bởi cron daily (velocity.scheduler) hoặc trigger thủ công.
 */
@Injectable()
export class VelocityService {
  private readonly logger = new Logger(VelocityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cfg: AppConfig,
  ) {}

  async recomputeAll(): Promise<{ updated: number }> {
    const { velocityWindowDays } = this.cfg.inventory;
    const now = new Date();
    const from = new Date(now.getTime() - velocityWindowDays * 86_400_000);

    // Aggregate units sold per (productId, branchId) trong window
    const aggs = await this.prisma.$queryRaw<OrderItemAgg[]>(Prisma.sql`
      SELECT oi."productId" AS "productId",
             o."branchId"   AS "branchId",
             SUM(oi.quantity)::double precision AS qty
      FROM "OrderItem" oi
      JOIN "Order" o ON o.id = oi."orderId"
      WHERE o."purchasedAt" >= ${from}
        AND oi."productId" IS NOT NULL
        AND o."branchId"   IS NOT NULL
      GROUP BY oi."productId", o."branchId"
    `);

    // Lookup nhanh: "productId:branchId" → qty
    const aggMap = new Map<string, number>();
    for (const a of aggs) aggMap.set(`${a.productId}:${a.branchId}`, a.qty);

    // Duyệt toàn bộ ProductStock để update (đủ nhỏ trong scope 50 chi nhánh)
    const stocks = await this.prisma.productStock.findMany({
      select: {
        id: true,
        productId: true,
        branchId: true,
        onHand: true,
        lastStockIncreaseAt: true,
      },
    });

    const thresholds = {
      fastMoverDaily: this.cfg.inventory.fastMoverDaily,
      slowMoverDaily: this.cfg.inventory.slowMoverDaily,
      deadAgingDays: this.cfg.inventory.deadAgingDays,
    };
    const { leadTimeDays, safetyDays } = this.cfg.inventory;
    let updated = 0;

    for (const s of stocks) {
      const qty = aggMap.get(`${s.productId}:${s.branchId}`) ?? 0;
      const velocity = Number((qty / velocityWindowDays).toFixed(4));
      const reorderPoint = computeReorderPoint(velocity, leadTimeDays, safetyDays);
      const tag = computeVelocityTag(
        {
          velocity30d: velocity,
          onHand: s.onHand,
          agingDays: agingDays(s.lastStockIncreaseAt, now),
        },
        thresholds,
      );
      await this.prisma.productStock.update({
        where: { id: s.id },
        data: {
          velocity30d: velocity,
          reorderPoint,
          velocityTag: tag,
          velocityUpdatedAt: now,
        },
      });
      updated++;
    }

    this.logger.log(`Velocity recomputed for ${updated} (SP×CN) records`);
    return { updated };
  }
}
