import { VelocityTag } from '@prisma/client';

export interface VelocityTagInput {
  velocity30d: number;
  onHand: number;
  agingDays: number | null;
}

export interface VelocityThresholds {
  fastMoverDaily: number;
  slowMoverDaily: number;
  deadAgingDays: number;
}

/**
 * Xếp tag dựa trên (velocity, tồn hiện tại, aging):
 *  DEAD       — velocity == 0 AND onHand > 0 AND agingDays > deadAgingDays
 *  FAST_MOVER — velocity > fastMoverDaily
 *  SLOW_MOVER — velocity < slowMoverDaily (và > 0 hoặc 0 nhưng chưa DEAD)
 *  NORMAL     — còn lại
 *
 * Lưu ý: SP chưa có tồn kho (onHand === 0) không được đánh DEAD — chỉ đánh
 * FAST/SLOW/NORMAL theo velocity. DEAD phục vụ "xả hàng ế" → cần có hàng tồn.
 */
export function computeVelocityTag(
  input: VelocityTagInput,
  t: VelocityThresholds,
): VelocityTag {
  const { velocity30d, onHand, agingDays } = input;

  if (
    velocity30d === 0 &&
    onHand > 0 &&
    agingDays !== null &&
    agingDays > t.deadAgingDays
  ) {
    return VelocityTag.DEAD;
  }
  if (velocity30d > t.fastMoverDaily) return VelocityTag.FAST_MOVER;
  if (velocity30d < t.slowMoverDaily) return VelocityTag.SLOW_MOVER;
  return VelocityTag.NORMAL;
}

/**
 * Reorder point = ceil(velocity × (leadTime + safety)).
 * Null khi velocity = 0 (không có nhu cầu → không reorder tự động).
 */
export function computeReorderPoint(
  velocity30d: number,
  leadTimeDays: number,
  safetyDays: number,
): number | null {
  if (velocity30d <= 0) return null;
  return Math.ceil(velocity30d * (leadTimeDays + safetyDays));
}

export function agingDays(lastStockIncreaseAt: Date | null, now: Date): number | null {
  if (!lastStockIncreaseAt) return null;
  const ms = now.getTime() - lastStockIncreaseAt.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}
