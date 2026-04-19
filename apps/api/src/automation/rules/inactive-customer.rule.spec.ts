import { Campaign, CampaignType } from '@prisma/client';
import { InactiveCustomerRule } from './inactive-customer.rule';

describe('InactiveCustomerRule', () => {
  const NOW = new Date('2026-04-18T00:00:00Z');

  function build(prismaMock: unknown) {
    return new InactiveCustomerRule(prismaMock as never);
  }

  function buildCampaign(
    conditions: Record<string, unknown>,
    templateCode = 'ZNS_REACTIVATE',
  ): Campaign {
    return {
      id: 1,
      name: 'x',
      description: null,
      type: CampaignType.RECURRING,
      ruleCode: 'INACTIVE',
      conditions,
      templateId: 10,
      fallbackTemplateId: null,
      allowFallback: false,
      isActive: true,
      schedule: null,
      requiresApproval: false,
      refreshOnApprove: false,
      createdAt: NOW,
      updatedAt: NOW,
    } as unknown as Campaign;
  }

  it('filters by lastPurchaseAt older than inactiveDays, excludes cooldown', async () => {
    const prisma = {
      campaign: {
        findUnique: jest.fn().mockResolvedValue({ template: { code: 'ZNS_REACTIVATE' } }),
      },
      customer: {
        findMany: jest.fn().mockResolvedValue([
          { id: 1, phone: '0901', name: 'An', lastPurchaseAt: new Date('2026-02-01T00:00:00Z') },
          { id: 2, phone: '0902', name: 'Binh', lastPurchaseAt: new Date('2026-03-01T00:00:00Z') },
        ]),
      },
    };
    const rule = build(prisma);
    const campaign = buildCampaign({ inactiveDays: 30, cooldownDays: 14, limit: 100 });

    const matches = await rule.match({ campaign, now: NOW });

    expect(matches).toHaveLength(2);
    const where = prisma.customer.findMany.mock.calls[0][0].where;
    // lastPurchaseAt < now - 30d = 2026-03-19
    expect(where.lastPurchaseAt.lt).toEqual(new Date('2026-03-19T00:00:00Z'));
    // cooldown filter present
    expect(where.messageLogs.none.templateCode).toBe('ZNS_REACTIVATE');
    expect(where.messageLogs.none.queuedAt.gt).toEqual(new Date('2026-04-04T00:00:00Z'));

    expect(matches[0].variables).toMatchObject({
      name: 'An',
      lastVisit: '2026-02-01',
      daysInactive: 30,
    });
  });

  it('omits cooldown filter when template has no code', async () => {
    const prisma = {
      campaign: { findUnique: jest.fn().mockResolvedValue({ template: null }) },
      customer: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const rule = build(prisma);
    await rule.match({ campaign: buildCampaign({ inactiveDays: 30 }), now: NOW });
    const where = prisma.customer.findMany.mock.calls[0][0].where;
    expect(where.messageLogs).toBeUndefined();
  });

  it('applies customerIdHint (TRIGGERED path)', async () => {
    const prisma = {
      campaign: { findUnique: jest.fn().mockResolvedValue({ template: { code: 'T' } }) },
      customer: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const rule = build(prisma);
    await rule.match({
      campaign: buildCampaign({ inactiveDays: 30 }),
      now: NOW,
      customerIdHint: [5, 6, 7],
    });
    expect(prisma.customer.findMany.mock.calls[0][0].where.id).toEqual({ in: [5, 6, 7] });
  });
});
