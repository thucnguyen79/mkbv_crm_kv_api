import { Campaign, CampaignType, LoyaltyTier } from '@prisma/client';
import { CustomSegmentRule } from './custom-segment.rule';

const NOW = new Date('2026-04-18T00:00:00Z');

function campaign(conditions: Record<string, unknown>): Campaign {
  return {
    id: 1,
    ruleCode: 'CUSTOM_SEGMENT',
    type: CampaignType.ONE_OFF,
    conditions,
    templateId: 10,
    isActive: true,
    requiresApproval: true,
    refreshOnApprove: false,
    allowFallback: false,
    fallbackTemplateId: null,
    schedule: null,
    createdAt: NOW,
    updatedAt: NOW,
    name: 'x',
    description: null,
  } as unknown as Campaign;
}

describe('CustomSegmentRule', () => {
  it('builds where with spent / tier / productIds / cooldown', async () => {
    const prisma = {
      campaign: {
        findUnique: jest.fn().mockResolvedValue({ template: { code: 'ZNS_X' } }),
      },
      customer: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 1,
            phone: '0901',
            name: 'An',
            totalSpent: 3_000_000,
            loyalty: { tier: LoyaltyTier.GOLD, lifetimePoints: 500 },
          },
        ]),
      },
    };
    const rule = new CustomSegmentRule(prisma as never);
    const m = await rule.match({
      campaign: campaign({
        minSpent: 2_000_000,
        tier: 'GOLD',
        productIds: [101, 102],
        purchasedSince: '2026-01-01',
        cooldownDays: 14,
      }),
      now: NOW,
    });

    const where = prisma.customer.findMany.mock.calls[0][0].where;
    expect(where.totalSpent.gte).toBe(2_000_000);
    expect(where.loyalty.is.tier).toBe('GOLD');
    expect(where.orders.some.items.some.productId.in).toEqual([101, 102]);
    expect(where.orders.some.purchasedAt.gte).toEqual(new Date('2026-01-01T00:00:00Z'));
    expect(where.messageLogs.none.templateCode).toBe('ZNS_X');
    expect(m[0].variables).toMatchObject({ name: 'An', tier: 'GOLD' });
  });

  it('applies minOrders via groupBy aggregate filter', async () => {
    const candidates = [
      { id: 1, phone: '0901', name: 'A', totalSpent: 0, loyalty: null },
      { id: 2, phone: '0902', name: 'B', totalSpent: 0, loyalty: null },
      { id: 3, phone: '0903', name: 'C', totalSpent: 0, loyalty: null },
    ];
    const prisma = {
      campaign: { findUnique: jest.fn().mockResolvedValue({ template: null }) },
      customer: { findMany: jest.fn().mockResolvedValue(candidates) },
      order: {
        groupBy: jest.fn().mockResolvedValue([
          { customerId: 1, _count: { _all: 5 } },
          { customerId: 2, _count: { _all: 2 } },
          { customerId: 3, _count: { _all: 10 } },
        ]),
      },
    };
    const rule = new CustomSegmentRule(prisma as never);
    const m = await rule.match({
      campaign: campaign({ minOrders: 3 }),
      now: NOW,
    });
    expect(m.map((x) => x.customerId).sort()).toEqual([1, 3]);
  });
});
