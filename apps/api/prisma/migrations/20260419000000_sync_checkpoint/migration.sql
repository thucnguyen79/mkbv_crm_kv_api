-- Add checkpoint fields to SyncCursor for per-page resume
ALTER TABLE "SyncCursor"
  ADD COLUMN "checkpointSince"  TIMESTAMP(3),
  ADD COLUMN "checkpointOffset" INTEGER NOT NULL DEFAULT 0;
