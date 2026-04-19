-- Role, Permission, RolePermission + User.roleId

CREATE TABLE "Role" (
  "id"          SERIAL NOT NULL,
  "code"        TEXT   NOT NULL,
  "name"        TEXT   NOT NULL,
  "description" TEXT,
  "isSystem"    BOOLEAN NOT NULL DEFAULT false,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code");

CREATE TABLE "Permission" (
  "id"          SERIAL NOT NULL,
  "code"        TEXT   NOT NULL,
  "resource"    TEXT   NOT NULL,
  "action"      TEXT   NOT NULL,
  "group"       TEXT   NOT NULL,
  "description" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Permission_code_key" ON "Permission"("code");
CREATE INDEX "Permission_resource_idx" ON "Permission"("resource");
CREATE INDEX "Permission_group_idx" ON "Permission"("group");

CREATE TABLE "RolePermission" (
  "roleId"       INTEGER NOT NULL,
  "permissionId" INTEGER NOT NULL,
  "grantedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId", "permissionId")
);
CREATE INDEX "RolePermission_permissionId_idx" ON "RolePermission"("permissionId");

ALTER TABLE "RolePermission"
  ADD CONSTRAINT "RolePermission_roleId_fkey"
  FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "RolePermission_permissionId_fkey"
  FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- User.roleId
ALTER TABLE "User" ADD COLUMN "roleId" INTEGER;
CREATE INDEX "User_roleId_idx" ON "User"("roleId");
ALTER TABLE "User"
  ADD CONSTRAINT "User_roleId_fkey"
  FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;
