import { PrismaClient, UserRole, MessageChannel } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import {
  ALL_PERMISSION_CODES,
  PERMISSIONS,
  ROLE_PRESETS,
} from '../src/auth/permissions/permissions.catalog';

const prisma = new PrismaClient();

async function syncPermissions(): Promise<Map<string, number>> {
  // Upsert catalog vào DB (idempotent)
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: p.code },
      create: p,
      update: {
        resource: p.resource,
        action: p.action,
        group: p.group,
        description: p.description ?? null,
      },
    });
  }
  const rows = await prisma.permission.findMany({ select: { id: true, code: true } });
  return new Map(rows.map((r) => [r.code, r.id]));
}

async function syncRolePresets(permIds: Map<string, number>): Promise<Map<string, number>> {
  for (const preset of ROLE_PRESETS) {
    const role = await prisma.role.upsert({
      where: { code: preset.code },
      create: {
        code: preset.code,
        name: preset.name,
        description: preset.description,
        isSystem: true,
      },
      update: {
        name: preset.name,
        description: preset.description,
        isSystem: true,
      },
    });

    // Attach permissions — full set cho admin, permission list cho manager/staff
    const codes = preset.all ? ALL_PERMISSION_CODES : preset.permissions;
    const ids = codes
      .map((code) => permIds.get(code))
      .filter((id): id is number => !!id);

    // Clear + re-add để sync đúng (first boot). Sau này admin thay đổi qua UI
    // sẽ không bị ghi đè (seed chỉ chạy 1 lần ban đầu).
    const existing = await prisma.rolePermission.findMany({
      where: { roleId: role.id },
      select: { permissionId: true },
    });
    if (existing.length === 0) {
      await prisma.rolePermission.createMany({
        data: ids.map((permissionId) => ({ roleId: role.id, permissionId })),
        skipDuplicates: true,
      });
    }
  }
  const rows = await prisma.role.findMany({ select: { id: true, code: true } });
  return new Map(rows.map((r) => [r.code, r.id]));
}

async function main() {
  // ===== Permissions + roles =====
  const permIds = await syncPermissions();
  const roleIds = await syncRolePresets(permIds);
  console.log(`✓ permissions: ${permIds.size}, roles: ${roleIds.size}`);

  // ===== Admin user =====
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@mkbv.local';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const adminRoleId = roleIds.get('admin')!;
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      email: adminEmail,
      passwordHash,
      fullName: 'System Admin',
      role: UserRole.ADMIN,
      roleId: adminRoleId,
    },
    update: { roleId: adminRoleId },
  });
  console.log(`✓ admin ensured: ${admin.email}`);

  // Backfill user cũ chưa có roleId — dựa theo enum `role`
  const backfillMap: Record<UserRole, string> = {
    ADMIN: 'admin',
    MANAGER: 'manager',
    STAFF: 'staff',
  };
  const usersWithoutRole = await prisma.user.findMany({
    where: { roleId: null },
    select: { id: true, role: true },
  });
  for (const u of usersWithoutRole) {
    const target = roleIds.get(backfillMap[u.role]);
    if (target) {
      await prisma.user.update({ where: { id: u.id }, data: { roleId: target } });
    }
  }
  if (usersWithoutRole.length) {
    console.log(`✓ backfilled roleId for ${usersWithoutRole.length} user(s)`);
  }

  // ===== Sync cursors =====
  const entities = ['branch', 'user', 'category', 'product', 'customer', 'order', 'invoice'];
  for (const entity of entities) {
    await prisma.syncCursor.upsert({
      where: { entity },
      create: { entity },
      update: {},
    });
  }
  console.log(`✓ sync cursors ensured: ${entities.length}`);

  // ===== Message templates =====
  const templates = [
    {
      code: 'ZNS_REACTIVATE_30D',
      channel: MessageChannel.ZNS,
      name: 'Mời khách quay lại sau 30 ngày',
      body: 'Chào {{name}}, đã 30 ngày kể từ lần khám gần nhất. Đặt lịch ngay để nhận ưu đãi!',
      variables: { name: 'string', lastVisit: 'date' },
    },
    {
      code: 'ZNS_BIRTHDAY',
      channel: MessageChannel.ZNS,
      name: 'Chúc mừng sinh nhật',
      body: 'Chúc mừng sinh nhật {{name}}! Tặng bạn voucher 10% cho đơn tiếp theo.',
      variables: { name: 'string' },
    },
    {
      code: 'ZNS_TIER_UPGRADE',
      channel: MessageChannel.ZNS,
      name: 'Nâng hạng thành viên',
      body: 'Chúc mừng {{name}} đã được nâng hạng {{tier}}!',
      variables: { name: 'string', tier: 'string' },
    },
    {
      code: 'SMS_REACTIVATE_30D',
      channel: MessageChannel.SMS,
      name: 'Fallback SMS mời quay lại',
      body: 'MKBV: Chao {{name}}, dat lich kham mat ngay de nhan uu dai.',
      variables: { name: 'string' },
    },
  ];
  for (const t of templates) {
    await prisma.messageTemplate.upsert({
      where: { code: t.code },
      create: t,
      update: {},
    });
  }
  console.log(`✓ templates ensured: ${templates.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
