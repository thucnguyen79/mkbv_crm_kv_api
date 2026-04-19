import { LoyaltyTier } from '@prisma/client';
import { computePoints, computeTier, isTierUpgrade, TIER_RANK } from './tier.config';

const thresholds = {
  memberThreshold: 300,
  silverThreshold: 1_000,
  titanThreshold: 2_500,
  goldThreshold: 5_000,
  platinumThreshold: 10_000,
};

describe('computeTier (5 bậc + GUEST)', () => {
  it.each([
    [0, LoyaltyTier.GUEST],
    [299, LoyaltyTier.GUEST],
    [300, LoyaltyTier.MEMBER],
    [999, LoyaltyTier.MEMBER],
    [1_000, LoyaltyTier.SILVER],
    [2_499, LoyaltyTier.SILVER],
    [2_500, LoyaltyTier.TITAN],
    [4_999, LoyaltyTier.TITAN],
    [5_000, LoyaltyTier.GOLD],
    [9_999, LoyaltyTier.GOLD],
    [10_000, LoyaltyTier.PLATINUM],
    [50_000, LoyaltyTier.PLATINUM],
  ])('lifetimePoints=%d → %s', (points, expected) => {
    expect(computeTier(points, thresholds)).toBe(expected);
  });
});

describe('computePoints (config-driven rate)', () => {
  it.each([
    [0, 10_000, 0],
    [9_999, 10_000, 0],
    [10_000, 10_000, 1],
    [25_000, 10_000, 2], // floor
    [3_000_000, 10_000, 300], // 300 điểm ≈ 3M VND → Hội viên
    [100_000_000, 10_000, 10_000], // Bạch kim
    [10_000, 5_000, 2], // tỷ lệ 1 điểm / 5k VND
  ])('totalSpent=%d, pointPerVnd=%d → %d points', (spent, rate, expected) => {
    expect(computePoints(spent, rate)).toBe(expected);
  });

  it('throws when pointPerVnd <= 0', () => {
    expect(() => computePoints(1_000, 0)).toThrow();
  });
});

describe('isTierUpgrade', () => {
  it('detects step-up through all 6 levels', () => {
    const order: LoyaltyTier[] = [
      LoyaltyTier.GUEST,
      LoyaltyTier.MEMBER,
      LoyaltyTier.SILVER,
      LoyaltyTier.TITAN,
      LoyaltyTier.GOLD,
      LoyaltyTier.PLATINUM,
    ];
    for (let i = 0; i < order.length - 1; i++) {
      expect(isTierUpgrade(order[i], order[i + 1])).toBe(true);
      expect(isTierUpgrade(order[i + 1], order[i])).toBe(false);
    }
  });

  it('rank indices are sequential 0..5', () => {
    const ranks = Object.values(TIER_RANK).sort();
    expect(ranks).toEqual([0, 1, 2, 3, 4, 5]);
  });
});
