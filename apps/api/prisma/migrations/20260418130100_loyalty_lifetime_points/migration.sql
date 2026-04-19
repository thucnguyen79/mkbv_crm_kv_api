-- Thêm cột lifetimePoints + đổi default tier sang GUEST.
-- Backfill lifetimePoints = points hiện tại (coi điểm cũ đã là điểm tích lũy lifetime).

ALTER TABLE "LoyaltyAccount"
  ADD COLUMN "lifetimePoints" INTEGER NOT NULL DEFAULT 0;

UPDATE "LoyaltyAccount" SET "lifetimePoints" = "points";

ALTER TABLE "LoyaltyAccount" ALTER COLUMN "tier" SET DEFAULT 'GUEST';
