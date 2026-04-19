import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AutomationRule, CustomerMatch, RuleContext } from './rule.interface';
import { subDays } from '../date.util';

interface Conditions {
  cooldownDays?: number; // default 365 — 1 lần/năm
  limit?: number;
}

@Injectable()
export class BirthdayRule implements AutomationRule {
  readonly code = 'BIRTHDAY';
  readonly description = 'Khách có sinh nhật hôm nay';
  readonly conditionsSchema = {
    cooldownDays: { type: 'number', default: 365 },
    limit: { type: 'number', default: 500 },
  };

  constructor(private readonly prisma: PrismaService) {}

  async match(ctx: RuleContext): Promise<CustomerMatch[]> {
    const cond = (ctx.campaign.conditions ?? {}) as unknown as Conditions;
    const cooldown = Number(cond.cooldownDays ?? 365);
    const limit = Number(cond.limit ?? 500);

    // Match by month + day. Postgres EXTRACT cần raw — dùng $queryRaw để tránh fetch hết DB.
    const month = ctx.now.getMonth() + 1;
    const day = ctx.now.getDate();

    const rows = await this.prisma.$queryRaw<
      Array<{ id: number; phone: string; name: string; birthDate: Date }>
    >(Prisma.sql`
      SELECT id, phone, name, "birthDate"
      FROM "Customer"
      WHERE "birthDate" IS NOT NULL
        AND EXTRACT(MONTH FROM "birthDate") = ${month}
        AND EXTRACT(DAY   FROM "birthDate") = ${day}
        ${
          ctx.customerIdHint?.length
            ? Prisma.sql`AND id = ANY(${ctx.customerIdHint})`
            : Prisma.empty
        }
      LIMIT ${limit * 2}
    `);

    if (!rows.length) return [];

    // Cooldown filter (không dùng raw join để giữ đơn giản)
    const templateCode = (
      await this.prisma.campaign.findUnique({
        where: { id: ctx.campaign.id },
        include: { template: { select: { code: true } } },
      })
    )?.template?.code;

    let eligible = rows;
    if (templateCode && cooldown > 0) {
      const recent = new Set(
        (
          await this.prisma.messageLog.findMany({
            where: {
              customerId: { in: rows.map((r) => r.id) },
              templateCode,
              queuedAt: { gt: subDays(ctx.now, cooldown) },
            },
            select: { customerId: true },
          })
        )
          .map((r) => r.customerId)
          .filter((id): id is number => id !== null),
      );
      eligible = rows.filter((r) => !recent.has(r.id));
    }

    return eligible.slice(0, limit).map((c) => ({
      customerId: c.id,
      phone: c.phone,
      variables: { name: c.name, birthDate: c.birthDate.toISOString().slice(0, 10) },
    }));
  }
}
