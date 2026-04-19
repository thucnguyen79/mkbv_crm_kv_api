ALTER TABLE "Customer" ADD COLUMN "deletedAt" TIMESTAMP(3);
CREATE INDEX "Customer_deletedAt_idx" ON "Customer"("deletedAt");
