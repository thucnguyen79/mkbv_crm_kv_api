-- Setting key-value table: DB-backed config override .env
CREATE TABLE "Setting" (
  "key"         TEXT        NOT NULL,
  "value"       TEXT        NOT NULL,
  "encrypted"   BOOLEAN     NOT NULL DEFAULT false,
  "description" TEXT,
  "updatedById" INTEGER,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);
