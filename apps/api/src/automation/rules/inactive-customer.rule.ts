import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AutomationRule, CustomerMatch, RuleContext } from './rule.interface';
import { subDays } from '../date.util';

interface Conditions {
  inactiveDays: number; // ≥ N ngày chưa mua hàng
  cooldownDays?: number; // không gửi lại tin cùng template trong N ngày
  limit?: number;
}

@Injectable()
export class InactiveCustomerRule implements AutomationRule {
  readonly code = 'INACTIVE';
  readonly description = 'Khách đã mua nhưng > N ngày không quay lại';
  readonly conditionsSchema = {
    inactiveDays: { type: 'number', required: true, description: 'Ngày từ lần mua gần nhất' },
    cooldownDays: { type: 'number', default: 14 },
    limit: { type: 'number', default: 500 },
  };

  constructor(private readonly prisma: PrismaService) {}

  async match(ctx: RuleContext): Promise<CustomerMatch[]> {
    const cond = (ctx.campaign.conditions ?? {}) as unknown as Conditions;
    const days = Number(cond.inactiveDays ?? 30);
    const cooldown = Number(cond.cooldownDays ?? 14);
    const limit = Number(cond.limit ?? 500);
    const templateCode = (await this.prisma.campaign.findUnique({
      where: { id: ctx.campaign.id },
      include: { template: { select: { code: true } } },
    }))?.template?.code;

    const where: Prisma.CustomerWhereInput = {
      lastPurchaseAt: { lt: subDays(ctx.now, days), not: null },
    };
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
      select: { id: true, phone: true, name: true, lastPurchaseAt: true },
      take: limit,
    });

    return rows.map((c) => ({
      customerId: c.id,
      phone: c.phone,
      variables: {
        name: c.name,
        lastVisit: c.lastPurchaseAt?.toISOString().slice(0, 10) ?? '',
        daysInactive: days,
      },
    }));
  }
}
