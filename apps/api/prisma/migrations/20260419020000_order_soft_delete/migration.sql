ALTER TABLE "Order" ADD COLUMN "deletedAt" TIMESTAMP(3);
CREATE INDEX "Order_deletedAt_idx" ON "Order"("deletedAt");
