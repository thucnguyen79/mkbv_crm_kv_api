import { VelocityTag } from '@prisma/client';
import {
  agingDays,
  computeReorderPoint,
  computeVelocityTag,
} from './velocity.util';

const t = { fastMoverDaily: 1, slowMoverDaily: 0.1, deadAgingDays: 60 };

describe('computeVelocityTag', () => {
  it('DEAD when no sales + has stock + aging > threshold', () => {
    expect(
      computeVelocityTag({ velocity30d: 0, onHand: 5, agingDays: 90 }, t),
    ).toBe(VelocityTag.DEAD);
  });

  it('NOT DEAD when aging within threshold', () => {
    expect(
      computeVelocityTag({ velocity30d: 0, onHand: 5, agingDays: 30 }, t),
    ).toBe(VelocityTag.SLOW_MOVER);
  });

  it('NOT DEAD when onHand = 0 (no stock to clear)', () => {
    expect(
      computeVelocityTag({ velocity30d: 0, onHand: 0, agingDays: 999 }, t),
    ).toBe(VelocityTag.SLOW_MOVER);
  });

  it('FAST_MOVER when velocity > threshold', () => {
    expect(
      computeVelocityTag({ velocity30d: 2.5, onHand: 100, agingDays: 5 }, t),
    ).toBe(VelocityTag.FAST_MOVER);
  });

  it('SLOW_MOVER when below slow threshold but still some sales', () => {
    expect(
      computeVelocityTag({ velocity30d: 0.05, onHand: 20, agingDays: 10 }, t),
    ).toBe(VelocityTag.SLOW_MOVER);
  });

  it('NORMAL in between', () => {
    expect(
      computeVelocityTag({ velocity30d: 0.5, onHand: 20, agingDays: 10 }, t),
    ).toBe(VelocityTag.NORMAL);
  });
});

describe('computeReorderPoint', () => {
  it('ceil(velocity × (lead + safety))', () => {
    expect(computeReorderPoint(1.3, 7, 3)).toBe(13); // 1.3 × 10 = 13
    expect(computeReorderPoint(0.1, 7, 3)).toBe(1); // 0.1 × 10 = 1
    expect(computeReorderPoint(2.7, 5, 2)).toBe(19); // 2.7 × 7 = 18.9 → 19
  });

  it('null when no velocity', () => {
    expect(computeReorderPoint(0, 7, 3)).toBeNull();
    expect(computeReorderPoint(-1, 7, 3)).toBeNull();
  });
});

describe('agingDays', () => {
  const now = new Date('2026-04-18T00:00:00Z');
  it('computes days from last increase', () => {
    expect(agingDays(new Date('2026-01-18T00:00:00Z'), now)).toBe(90);
    expect(agingDays(new Date('2026-04-17T00:00:00Z'), now)).toBe(1);
  });
  it('null when never increased', () => {
    expect(agingDays(null, now)).toBeNull();
  });
});
