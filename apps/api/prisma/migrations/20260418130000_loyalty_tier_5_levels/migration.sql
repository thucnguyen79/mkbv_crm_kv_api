-- Mở rộng LoyaltyTier từ 3 → 6 giá trị (bao gồm GUEST cho < 300 điểm).
-- Postgres ADD VALUE ... BEFORE giữ đúng thứ tự rank logic (GUEST < MEMBER < SILVER < TITAN < GOLD < PLATINUM).
-- Phải chạy trước migration lifetimePoints (các enum value mới chưa được dùng trong cùng transaction).

ALTER TYPE "LoyaltyTier" ADD VALUE IF NOT EXISTS 'GUEST' BEFORE 'SILVER';
ALTER TYPE "LoyaltyTier" ADD VALUE IF NOT EXISTS 'MEMBER' BEFORE 'SILVER';
ALTER TYPE "LoyaltyTier" ADD VALUE IF NOT EXISTS 'TITAN' BEFORE 'GOLD';
