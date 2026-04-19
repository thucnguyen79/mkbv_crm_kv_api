import { Injectable } from '@nestjs/common';
import { LoyaltyTier, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AutomationRule, CustomerMatch, RuleContext } from './rule.interface';
import { subDays } from '../date.util';

interface Conditions {
  withinDays?: number; // chỉ xét tier update trong N ngày gần nhất
  minTier?: LoyaltyTier; // mặc định từ MEMBER trở lên
  cooldownDays?: number;
  limit?: number;
}

@Injectable()
export class TierUpgradeRule implements AutomationRule {
  readonly code = 'TIER_UPGRADE';
  readonly description = 'Khách vừa được nâng hạng trong N ngày gần nhất';
  readonly conditionsSchema = {
    withinDays: { type: 'number', default: 7 },
    minTier: { type: 'string', enum: ['MEMBER', 'SILVER', 'TITAN', 'GOLD', 'PLATINUM'] },
    cooldownDays: { type: 'number', default: 30 },
    limit: { type: 'number', default: 500 },
  };

  constructor(private readonly prisma: PrismaService) {}

  async match(ctx: RuleContext): Promise<CustomerMatch[]> {
    const cond = (ctx.campaign.conditions ?? {}) as unknown as Conditions;
    const withinDays = Number(cond.withinDays ?? 7);
    const cooldown = Number(cond.cooldownDays ?? 30);
    const limit = Number(cond.limit ?? 500);
    const minTier = cond.minTier;

    const templateCode = (
      await this.prisma.campaign.findUnique({
        where: { id: ctx.campaign.id },
        include: { template: { select: { code: true } } },
      })
    )?.template?.code;

    const loyaltyWhere: Prisma.LoyaltyAccountWhereInput = {
      tierUpdatedAt: { gt: subDays(ctx.now, withinDays) },
      tier: { not: LoyaltyTier.GUEST },
    };
    if (minTier) {
      loyaltyWhere.tier = { in: tiersFrom(minTier) };
    }

    const where: Prisma.CustomerWhereInput = { loyalty: { is: loyaltyWhere } };
    if (ctx.customerIdHint?.length) where.id = { in: ctx.customerIdHint };
    if (templateCode && cooldown > 0) {
      where.messageLogs = {
        none: {
          templateCode,
          queuedAt: { gt: subDays(ctx.now, cooldown) },
        },
      };
    }

    const rows = await this.prisma.customer.findMany({
      where,
      include: { loyalty: { select: { tier: true, lifetimePoints: true } } },
      take: limit,
    });

    return rows
      .filter((r) => r.loyalty) // defensive
      .map((c) => ({
        customerId: c.id,
        phone: c.phone,
        variables: {
          name: c.name,
          tier: c.loyalty!.tier,
          tierLabel: TIER_LABEL[c.loyalty!.tier],
          lifetimePoints: c.loyalty!.lifetimePoints,
        },
      }));
  }
}

const TIER_ORDER: LoyaltyTier[] = [
  LoyaltyTier.GUEST,
  LoyaltyTier.MEMBER,
  LoyaltyTier.SILVER,
  LoyaltyTier.TITAN,
  LoyaltyTier.GOLD,
  LoyaltyTier.PLATINUM,
];

function tiersFrom(min: LoyaltyTier): LoyaltyTier[] {
  const i = TIER_ORDER.indexOf(min);
  return i < 0 ? TIER_ORDER.slice(1) : TIER_ORDER.slice(i);
}

const TIER_LABEL: Record<LoyaltyTier, string> = {
  [LoyaltyTier.GUEST]: 'Khách',
  [LoyaltyTier.MEMBER]: 'Hội viên',
  [LoyaltyTier.SILVER]: 'Bạc',
  [LoyaltyTier.TITAN]: 'Titan',
  [LoyaltyTier.GOLD]: 'Vàng',
  [LoyaltyTier.PLATINUM]: 'Bạch kim',
};
