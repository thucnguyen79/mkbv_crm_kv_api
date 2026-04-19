import { Injectable } from '@nestjs/common';
import { LoyaltyTier, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AutomationRule, CustomerMatch, RuleContext } from './rule.interface';
import { subDays } from '../date.util';

/**
 * Conditions (tất cả optional, `AND` với nhau):
 *   minOrders, maxOrders         — số bill trong window purchasedSince..purchasedUntil
 *   minSpent, maxSpent           — totalSpent lifetime (VND)
 *   productIds                   — đã mua ít nhất 1 SP trong list (ANY, trong window nếu có)
 *   branchIds                    — khách thuộc chi nhánh (Customer.branchId)
 *   tier                         — hạng hiện tại (single)
 *   purchasedSince / Until       — ISO date — áp dụng cho minOrders & productIds
 *   cooldownDays, limit          — anti-spam + cap
 */
interface Conditions {
  minOrders?: number;
  maxOrders?: number;
  minSpent?: number;
  maxSpent?: number;
  productIds?: number[];
  branchIds?: number[];
  tier?: LoyaltyTier;
  purchasedSince?: string;
  purchasedUntil?: string;
  cooldownDays?: number;
  limit?: number;
}

@Injectable()
export class CustomSegmentRule implements AutomationRule {
  readonly code = 'CUSTOM_SEGMENT';
  readonly description = 'Lọc khách theo số bill, chi tiêu, sản phẩm, chi nhánh, hạng';
  readonly conditionsSchema = {
    minOrders: { type: 'number' },
    maxOrders: { type: 'number' },
    minSpent: { type: 'number', description: 'VND tối thiểu đã tiêu' },
    maxSpent: { type: 'number' },
    productIds: { type: 'number[]', description: 'Đã mua ít nhất 1 trong các SP này' },
    branchIds: { type: 'number[]' },
    tier: { type: 'string', enum: ['MEMBER', 'SILVER', 'TITAN', 'GOLD', 'PLATINUM'] },
    purchasedSince: { type: 'iso-date' },
    purchasedUntil: { type: 'iso-date' },
    cooldownDays: { type: 'number', default: 14 },
    limit: { type: 'number', default: 500 },
  };

  constructor(private readonly prisma: PrismaService) {}

  async match(ctx: RuleContext): Promise<CustomerMatch[]> {
    const cond = (ctx.campaign.conditions ?? {}) as unknown as Conditions;
    const cooldown = Number(cond.cooldownDays ?? 14);
    const limit = Number(cond.limit ?? 500);

    const templateCode = (
      await this.prisma.campaign.findUnique({
        where: { id: ctx.campaign.id },
        include: { template: { select: { code: true } } },
      })
    )?.template?.code;

    const purchasedSince = cond.purchasedSince ? new Date(cond.purchasedSince) : null;
    const purchasedUntil = cond.purchasedUntil ? new Date(cond.purchasedUntil) : null;

    // ===== 1) Base customer filter =====
    const where: Prisma.CustomerWhereInput = {};
    if (ctx.customerIdHint?.length) where.id = { in: ctx.customerIdHint };
    if (cond.branchIds?.length) where.branchId = { in: cond.branchIds };
    if (cond.tier) where.loyalty = { is: { tier: cond.tier } };
    if (cond.minSpent !== undefined || cond.maxSpent !== undefined) {
      where.totalSpent = {};
      if (cond.minSpent !== undefined)
        (where.totalSpent as Prisma.DecimalFilter).gte = cond.minSpent;
      if (cond.maxSpent !== undefined)
        (where.totalSpent as Prisma.DecimalFilter).lte = cond.maxSpent;
    }
    if (cond.productIds?.length) {
      const orderFilter: Prisma.OrderWhereInput = {
        items: { some: { productId: { in: cond.productIds } } },
      };
      if (purchasedSince || purchasedUntil) {
        orderFilter.purchasedAt = {};
        if (purchasedSince) (orderFilter.purchasedAt as Prisma.DateTimeFilter).gte = purchasedSince;
        if (purchasedUntil) (orderFilter.purchasedAt as Prisma.DateTimeFilter).lte = purchasedUntil;
      }
      where.orders = { some: orderFilter };
    }
    if (templateCode && cooldown > 0) {
      where.messageLogs = {
        none: { templateCode, queuedAt: { gt: subDays(ctx.now, cooldown) } },
      };
    }

    // Pull candidates (over-fetch x2 để lọc minOrders sau đó)
    const candidates = await this.prisma.customer.findMany({
      where,
      include: { loyalty: { select: { tier: true, lifetimePoints: true } } },
      take: cond.minOrders || cond.maxOrders ? Math.min(limit * 4, 5_000) : limit,
    });
    if (!candidates.length) return [];

    // ===== 2) minOrders/maxOrders filter (aggregate) =====
    let passing = candidates;
    if (cond.minOrders !== undefined || cond.maxOrders !== undefined) {
      const candIds = candidates.map((c) => c.id);
      const orderWhere: Prisma.OrderWhereInput = { customerId: { in: candIds } };
      if (purchasedSince || purchasedUntil) {
        orderWhere.purchasedAt = {};
        if (purchasedSince) (orderWhere.purchasedAt as Prisma.DateTimeFilter).gte = purchasedSince;
        if (purchasedUntil) (orderWhere.purchasedAt as Prisma.DateTimeFilter).lte = purchasedUntil;
      }
      const grouped = await this.prisma.order.groupBy({
        by: ['customerId'],
        where: orderWhere,
        _count: { _all: true },
      });
      const countByCustomer = new Map(grouped.map((g) => [g.customerId ?? -1, g._count._all]));
      passing = candidates.filter((c) => {
        const n = countByCustomer.get(c.id) ?? 0;
        if (cond.minOrders !== undefined && n < cond.minOrders) return false;
        if (cond.maxOrders !== undefined && n > cond.maxOrders) return false;
        return true;
      });
    }

    return passing.slice(0, limit).map((c) => ({
      customerId: c.id,
      phone: c.phone,
      variables: {
        name: c.name,
        totalSpent: Number(c.totalSpent),
        tier: c.loyalty?.tier ?? 'GUEST',
        lifetimePoints: c.loyalty?.lifetimePoints ?? 0,
      },
    }));
  }
}
