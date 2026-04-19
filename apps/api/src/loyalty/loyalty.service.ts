import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { LoyaltyAccount, LoyaltyTier } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AppConfig } from '../config/app.config';
import {
  computePoints,
  computeTier,
  isTierUpgrade,
  TierThresholds,
} from './tier.config';

export interface LoyaltyStatus {
  customerId: number;
  totalSpent: number;
  points: number; // balance
  lifetimePoints: number; // tổng tích lũy
  tier: LoyaltyTier;
  previousTier?: LoyaltyTier;
  upgraded: boolean;
}

@Injectable()
export class LoyaltyService {
  private readonly logger = new Logger(LoyaltyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cfg: AppConfig,
  ) {}

  private get thresholds(): TierThresholds {
    const l = this.cfg.loyalty;
    return {
      memberThreshold: l.memberThreshold,
      silverThreshold: l.silverThreshold,
      titanThreshold: l.titanThreshold,
      goldThreshold: l.goldThreshold,
      platinumThreshold: l.platinumThreshold,
    };
  }

  /**
   * Recalculate lifetime points + tier từ `totalSpent`. Idempotent.
   *
   * Ghi chú:
   *  - `lifetimePoints` được suy ra từ `totalSpent` (không có redeem ngoài hóa đơn).
   *  - `points` balance tạm bằng `lifetimePoints` (khi có redeem ledger thực sự,
   *    tách ra = lifetime - sum(redeem transactions) — TODO khi làm feature redeem).
   *  - `tier` xét theo `lifetimePoints` (không tụt khi redeem).
   */
  async recalculate(customerId: number): Promise<LoyaltyStatus> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      include: { loyalty: true },
    });
    if (!customer) throw new NotFoundException(`Customer ${customerId} not found`);

    const totalSpent = Number(customer.totalSpent);
    const newLifetime = computePoints(totalSpent, this.cfg.loyalty.pointPerVnd);
    const newTier = computeTier(newLifetime, this.thresholds);
    const prev = customer.loyalty;

    // Lifetime chỉ tăng — nếu giá trị tính mới < cũ (hiếm: hoàn đơn), giữ cũ.
    const lifetimePoints = Math.max(prev?.lifetimePoints ?? 0, newLifetime);
    // Balance: nếu chưa có ledger redeem, trùng lifetime.
    const points = lifetimePoints;
    const tierUpdatedAt =
      prev?.tier !== newTier ? new Date() : (prev?.tierUpdatedAt ?? new Date());

    const saved: LoyaltyAccount = await this.prisma.loyaltyAccount.upsert({
      where: { customerId },
      create: { customerId, points, lifetimePoints, tier: newTier, tierUpdatedAt },
      update: { points, lifetimePoints, tier: newTier, tierUpdatedAt },
    });

    const upgraded = !!prev && isTierUpgrade(prev.tier, saved.tier);
    if (upgraded) {
      this.logger.log(
        `🎖 customer ${customerId} upgraded ${prev?.tier} → ${saved.tier} (lifetime=${lifetimePoints})`,
      );
    }
    return {
      customerId,
      totalSpent,
      points: saved.points,
      lifetimePoints: saved.lifetimePoints,
      tier: saved.tier,
      previousTier: prev?.tier,
      upgraded,
    };
  }

  async recalculateBatch(customerIds: number[]): Promise<LoyaltyStatus[]> {
    const out: LoyaltyStatus[] = [];
    for (const id of customerIds) {
      try {
        out.push(await this.recalculate(id));
      } catch (err) {
        this.logger.warn(`recalculate customer=${id} failed: ${(err as Error).message}`);
      }
    }
    return out;
  }

  async getStatus(
    customerId: number,
  ): Promise<
    LoyaltyStatus & { transactions: Array<{ points: number; reason: string; createdAt: Date }> }
  > {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        loyalty: { include: { transactions: { orderBy: { createdAt: 'desc' }, take: 20 } } },
      },
    });
    if (!customer) throw new NotFoundException(`Customer ${customerId} not found`);
    if (!customer.loyalty) {
      await this.recalculate(customerId);
      return this.getStatus(customerId);
    }
    return {
      customerId,
      totalSpent: Number(customer.totalSpent),
      points: customer.loyalty.points,
      lifetimePoints: customer.loyalty.lifetimePoints,
      tier: customer.loyalty.tier,
      upgraded: false,
      transactions: customer.loyalty.transactions.map((t) => ({
        points: t.points,
        reason: t.reason,
        createdAt: t.createdAt,
      })),
    };
  }
}
