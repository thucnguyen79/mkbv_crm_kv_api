-- =====================================================================
-- Inventory module — Product extensions, stock, variants, attributes,
-- images, notifications. Tất cả enum type MỚI → không gặp rule
-- "enum value chưa dùng được trong cùng transaction".
-- =====================================================================

-- CreateEnum
CREATE TYPE "VelocityTag" AS ENUM ('FAST_MOVER', 'NORMAL', 'SLOW_MOVER', 'DEAD');
CREATE TYPE "AttributeKind" AS ENUM ('STRING', 'ENUM', 'NUMBER', 'BOOLEAN');
CREATE TYPE "NotificationType" AS ENUM (
  'LOW_STOCK',
  'DEAD_STOCK',
  'TRANSFER_SUGGESTION',
  'INVENTORY_ALERT'
);
CREATE TYPE "NotificationSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- =====================================================================
-- Product: thêm cột
-- =====================================================================
ALTER TABLE "Product"
  ADD COLUMN "costPrice"       DECIMAL(18, 2) NOT NULL DEFAULT 0,
  ADD COLUMN "barcode"         TEXT,
  ADD COLUMN "description"     TEXT,
  ADD COLUMN "isTracked"       BOOLEAN       NOT NULL DEFAULT true,
  ADD COLUMN "tags"            TEXT[]        NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "attributes"      JSONB,
  ADD COLUMN "minStock"        INTEGER,
  ADD COLUMN "masterProductId" BIGINT,
  ADD COLUMN "masterCode"      TEXT,
  ADD COLUMN "variantGroupId"  INTEGER;

CREATE INDEX "Product_variantGroupId_idx"  ON "Product"("variantGroupId");
CREATE INDEX "Product_masterProductId_idx" ON "Product"("masterProductId");
CREATE INDEX "Product_tags_idx" ON "Product" USING GIN ("tags");

-- =====================================================================
-- ProductVariantGroup
-- =====================================================================
CREATE TABLE "ProductVariantGroup" (
  "id"          SERIAL NOT NULL,
  "code"        TEXT   NOT NULL,
  "name"        TEXT   NOT NULL,
  "description" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductVariantGroup_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProductVariantGroup_code_key" ON "ProductVariantGroup"("code");

ALTER TABLE "Product"
  ADD CONSTRAINT "Product_variantGroupId_fkey"
  FOREIGN KEY ("variantGroupId") REFERENCES "ProductVariantGroup"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- =====================================================================
-- ProductStock
-- =====================================================================
CREATE TABLE "ProductStock" (
  "id"                  SERIAL NOT NULL,
  "productId"           INTEGER NOT NULL,
  "branchId"            INTEGER NOT NULL,
  "onHand"              INTEGER NOT NULL DEFAULT 0,
  "reserved"            INTEGER NOT NULL DEFAULT 0,
  "lastStockIncreaseAt" TIMESTAMP(3),
  "velocity30d"         DOUBLE PRECISION NOT NULL DEFAULT 0,
  "reorderPoint"        INTEGER,
  "velocityTag"         "VelocityTag",
  "velocityUpdatedAt"   TIMESTAMP(3),
  "lastKvSyncedAt"      TIMESTAMP(3),
  CONSTRAINT "ProductStock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductStock_productId_branchId_key"
  ON "ProductStock"("productId", "branchId");
CREATE INDEX "ProductStock_branchId_onHand_idx"       ON "ProductStock"("branchId", "onHand");
CREATE INDEX "ProductStock_velocityTag_idx"           ON "ProductStock"("velocityTag");
CREATE INDEX "ProductStock_lastStockIncreaseAt_idx"   ON "ProductStock"("lastStockIncreaseAt");

ALTER TABLE "ProductStock"
  ADD CONSTRAINT "ProductStock_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ProductStock_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id")   ON DELETE RESTRICT ON UPDATE CASCADE;

-- =====================================================================
-- ProductImage
-- =====================================================================
CREATE TABLE "ProductImage" (
  "id"        SERIAL NOT NULL,
  "productId" INTEGER NOT NULL,
  "url"       TEXT    NOT NULL,
  "filename"  TEXT    NOT NULL,
  "mimeType"  TEXT    NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "order"     INTEGER NOT NULL DEFAULT 0,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "caption"   TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductImage_productId_idx" ON "ProductImage"("productId");

ALTER TABLE "ProductImage"
  ADD CONSTRAINT "ProductImage_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =====================================================================
-- AttributeDefinition
-- =====================================================================
CREATE TABLE "AttributeDefinition" (
  "id"        SERIAL NOT NULL,
  "code"      TEXT   NOT NULL,
  "label"     TEXT   NOT NULL,
  "kind"      "AttributeKind" NOT NULL,
  "options"   JSONB,
  "isActive"  BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AttributeDefinition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AttributeDefinition_code_key" ON "AttributeDefinition"("code");

-- =====================================================================
-- Notification
-- =====================================================================
CREATE TABLE "Notification" (
  "id"         BIGSERIAL NOT NULL,
  "type"       "NotificationType"     NOT NULL,
  "severity"   "NotificationSeverity" NOT NULL DEFAULT 'INFO',
  "title"      TEXT NOT NULL,
  "body"       TEXT,
  "payload"    JSONB,
  "targetRole" "UserRole",
  "readBy"     INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Notification_targetRole_createdAt_idx" ON "Notification"("targetRole", "createdAt");
CREATE INDEX "Notification_type_createdAt_idx"       ON "Notification"("type", "createdAt");
