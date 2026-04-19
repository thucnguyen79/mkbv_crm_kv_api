import { LoyaltyTier } from '@prisma/client';

/**
 * Cấu hình tier dựa trên **lifetime points** (không phải VND chi tiêu).
 * Điểm được tính từ hóa đơn: `1 điểm / pointPerVnd đồng` (mặc định 10,000 VND/điểm).
 * Tất cả ngưỡng + tỷ lệ đều đi từ env (xem AppConfig.loyalty) nên có thể tune không cần redeploy.
 */
export interface TierThresholds {
  memberThreshold: number; // ≥ điểm → MEMBER  (Hội viên)
  silverThreshold: number; // ≥ điểm → SILVER  (Bạc)
  titanThreshold: number; // ≥ điểm → TITAN   (Titan)
  goldThreshold: number; // ≥ điểm → GOLD    (Vàng)
  platinumThreshold: number; // ≥ điểm → PLATINUM (Bạch kim)
}

/** Xét hạng từ lifetime points. Dưới memberThreshold trả về GUEST (chưa đạt hạng). */
export function computeTier(lifetimePoints: number, t: TierThresholds): LoyaltyTier {
  if (lifetimePoints >= t.platinumThreshold) return LoyaltyTier.PLATINUM;
  if (lifetimePoints >= t.goldThreshold) return LoyaltyTier.GOLD;
  if (lifetimePoints >= t.titanThreshold) return LoyaltyTier.TITAN;
  if (lifetimePoints >= t.silverThreshold) return LoyaltyTier.SILVER;
  if (lifetimePoints >= t.memberThreshold) return LoyaltyTier.MEMBER;
  return LoyaltyTier.GUEST;
}

/** Tính điểm từ tổng chi tiêu (VND). `pointPerVnd` = số VND đổi 1 điểm. */
export function computePoints(totalSpent: number, pointPerVnd: number): number {
  if (pointPerVnd <= 0) throw new Error('pointPerVnd must be > 0');
  return Math.floor(totalSpent / pointPerVnd);
}

/** Thứ tự hạng — dùng để phát hiện nâng hạng (upgrade). */
export const TIER_RANK: Record<LoyaltyTier, number> = {
  [LoyaltyTier.GUEST]: 0,
  [LoyaltyTier.MEMBER]: 1,
  [LoyaltyTier.SILVER]: 2,
  [LoyaltyTier.TITAN]: 3,
  [LoyaltyTier.GOLD]: 4,
  [LoyaltyTier.PLATINUM]: 5,
};

export function isTierUpgrade(prev: LoyaltyTier, next: LoyaltyTier): boolean {
  return TIER_RANK[next] > TIER_RANK[prev];
}
