-- 1) UserRole: thêm MANAGER
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'MANAGER' AFTER 'ADMIN';

-- 2) CampaignRunStatus enum
CREATE TYPE "CampaignRunStatus" AS ENUM (
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'EXECUTED',
  'CANCELLED'
);

-- 3) Campaign: thêm cờ approval + fallback + refresh
ALTER TABLE "Campaign"
  ADD COLUMN "allowFallback"    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "refreshOnApprove" BOOLEAN NOT NULL DEFAULT false;

-- 4) CampaignRun table
CREATE TABLE "CampaignRun" (
  "id"              SERIAL              NOT NULL,
  "campaignId"      INTEGER             NOT NULL,
  "status"          "CampaignRunStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
  "triggeredById"   INTEGER,
  "matchedCount"    INTEGER             NOT NULL DEFAULT 0,
  "snapshot"        JSONB               NOT NULL,
  "approvedById"    INTEGER,
  "approvedAt"      TIMESTAMP(3),
  "rejectedReason"  TEXT,
  "executedAt"      TIMESTAMP(3),
  "enqueuedCount"   INTEGER             NOT NULL DEFAULT 0,
  "note"            TEXT,
  "createdAt"       TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3)        NOT NULL,
  CONSTRAINT "CampaignRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CampaignRun_campaignId_createdAt_idx" ON "CampaignRun"("campaignId", "createdAt");
CREATE INDEX "CampaignRun_status_idx" ON "CampaignRun"("status");

ALTER TABLE "CampaignRun"
  ADD CONSTRAINT "CampaignRun_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 5) CampaignExecution: link ngược lên CampaignRun
ALTER TABLE "CampaignExecution"
  ADD COLUMN "campaignRunId" INTEGER;

CREATE INDEX "CampaignExecution_campaignRunId_idx" ON "CampaignExecution"("campaignRunId");

ALTER TABLE "CampaignExecution"
  ADD CONSTRAINT "CampaignExecution_campaignRunId_fkey"
  FOREIGN KEY ("campaignRunId") REFERENCES "CampaignRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
