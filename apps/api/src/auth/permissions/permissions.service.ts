import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PERMISSIONS } from './permissions.catalog';

/**
 * Cache per-role permission set + user → role mapping.
 * Invalidate khi admin đổi permission của role hoặc đổi role của user.
 */
@Injectable()
export class PermissionsService implements OnModuleInit {
  private readonly logger = new Logger(PermissionsService.name);
  /** roleId → Set<permissionCode> */
  private roleCache = new Map<number, Set<string>>();

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.syncCatalog();
    await this.reloadAll();
  }

  /** Upsert catalog permission từ code vào DB. Chạy mỗi boot — idempotent. */
  private async syncCatalog(): Promise<void> {
    for (const p of PERMISSIONS) {
      await this.prisma.permission.upsert({
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
    this.logger.log(`Permission catalog synced: ${PERMISSIONS.length} codes`);
  }

  /** Load toàn bộ role + permissions vào cache. */
  async reloadAll(): Promise<void> {
    const roles = await this.prisma.role.findMany({
      include: { permissions: { include: { permission: true } } },
    });
    this.roleCache.clear();
    for (const r of roles) {
      this.roleCache.set(r.id, new Set(r.permissions.map((rp) => rp.permission.code)));
    }
    this.logger.log(`Permissions cache rebuilt: ${roles.length} role(s)`);
  }

  /** Reload 1 role (khi admin edit permission) — tránh rebuild all. */
  async reloadRole(roleId: number): Promise<void> {
    const r = await this.prisma.role.findUnique({
      where: { id: roleId },
      include: { permissions: { include: { permission: true } } },
    });
    if (r) {
      this.roleCache.set(r.id, new Set(r.permissions.map((rp) => rp.permission.code)));
    }
  }

  /** Trả permission codes của 1 role. */
  getByRoleId(roleId: number | null | undefined): string[] {
    if (!roleId) return [];
    return Array.from(this.roleCache.get(roleId) ?? []);
  }

  hasPermission(roleId: number | null | undefined, code: string): boolean {
    if (!roleId) return false;
    return this.roleCache.get(roleId)?.has(code) ?? false;
  }

  hasAll(roleId: number | null | undefined, codes: string[]): boolean {
    if (!roleId || codes.length === 0) return codes.length === 0;
    const set = this.roleCache.get(roleId);
    if (!set) return false;
    return codes.every((c) => set.has(c));
  }
}
