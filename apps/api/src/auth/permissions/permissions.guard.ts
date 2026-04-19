import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { AuthUser } from '../decorators/current-user.decorator';
import { PERMISSIONS_KEY } from './permissions.decorator';
import { PermissionsService } from './permissions.service';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Guard mới hỗ trợ cả 2 decorator cũ + mới:
 *  - @Permissions('x.y') → check user có permission này qua role.permissions
 *  - @Roles(UserRole.ADMIN) → check user.role enum (legacy)
 *
 * Nếu cả 2 đều set: check cả 2 (AND).
 * Nếu không set gì: pass (route chỉ cần JWT valid — @Public() bỏ JWT riêng).
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissions: PermissionsService,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const requiredPerms = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    if (!requiredPerms?.length && !requiredRoles?.length) return true;

    const user = ctx.switchToHttp().getRequest().user as AuthUser | undefined;
    if (!user) throw new ForbiddenException('Unauthenticated');

    // Legacy role check
    if (requiredRoles?.length && !requiredRoles.includes(user.role)) {
      throw new ForbiddenException(
        `Role ${user.role} không được phép (cần: ${requiredRoles.join('|')})`,
      );
    }

    // Permission check
    if (requiredPerms?.length) {
      const ok = this.permissions.hasAll(user.roleId ?? null, requiredPerms);
      if (!ok) {
        throw new ForbiddenException(`Thiếu permission: ${requiredPerms.join(', ')}`);
      }
    }
    return true;
  }
}
