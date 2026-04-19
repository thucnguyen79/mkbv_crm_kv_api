import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { PermissionsService } from '../auth/permissions/permissions.service';
import {
  CreateRoleDto,
  RoleResponseDto,
  SetRolePermissionsDto,
  UpdateRoleDto,
} from './dto/role.dto';

type RoleWithRel = Prisma.RoleGetPayload<{
  include: {
    permissions: { include: { permission: true } };
    _count: { select: { users: true } };
  };
}>;

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
  ) {}

  async list(): Promise<RoleResponseDto[]> {
    const rows = await this.prisma.role.findMany({
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
      orderBy: [{ isSystem: 'desc' }, { id: 'asc' }],
    });
    return rows.map(toResponse);
  }

  async get(id: number): Promise<RoleResponseDto> {
    const r = await this.prisma.role.findUnique({
      where: { id },
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
    });
    if (!r) throw new NotFoundException(`Role ${id} not found`);
    return toResponse(r);
  }

  async create(dto: CreateRoleDto): Promise<RoleResponseDto> {
    const code = dto.code.trim().toLowerCase();
    if (['admin', 'manager', 'staff'].includes(code)) {
      throw new BadRequestException(`Code ${code} là preset hệ thống, không tạo lại được`);
    }
    try {
      const r = await this.prisma.role.create({
        data: {
          code,
          name: dto.name,
          description: dto.description ?? null,
          isSystem: false,
        },
        include: {
          permissions: { include: { permission: true } },
          _count: { select: { users: true } },
        },
      });
      await this.permissions.reloadRole(r.id);
      return toResponse(r);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException(`Role code ${code} đã tồn tại`);
      }
      throw err;
    }
  }

  async update(id: number, dto: UpdateRoleDto): Promise<RoleResponseDto> {
    const existing = await this.prisma.role.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Role ${id} not found`);
    if (existing.isSystem && dto.code && dto.code !== existing.code) {
      throw new ForbiddenException('Không đổi code của role hệ thống');
    }
    const r = await this.prisma.role.update({
      where: { id },
      data: {
        code: dto.code ?? existing.code,
        name: dto.name ?? existing.name,
        description: dto.description ?? existing.description,
      },
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
    });
    await this.permissions.reloadRole(r.id);
    return toResponse(r);
  }

  async remove(id: number): Promise<void> {
    const r = await this.prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (!r) throw new NotFoundException(`Role ${id} not found`);
    if (r.isSystem) throw new ForbiddenException('Không xoá role hệ thống (admin/manager/staff)');
    if (r._count.users > 0) {
      throw new BadRequestException(
        `Role đang gán cho ${r._count.users} user — đổi role họ trước khi xoá`,
      );
    }
    await this.prisma.role.delete({ where: { id } });
    await this.permissions.reloadAll();
  }

  async setPermissions(id: number, dto: SetRolePermissionsDto): Promise<RoleResponseDto> {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException(`Role ${id} not found`);

    // Validate codes tồn tại trong DB
    const perms = await this.prisma.permission.findMany({
      where: { code: { in: dto.codes } },
      select: { id: true, code: true },
    });
    const found = new Set(perms.map((p) => p.code));
    const unknown = dto.codes.filter((c) => !found.has(c));
    if (unknown.length) {
      throw new BadRequestException(`Unknown permission codes: ${unknown.join(', ')}`);
    }

    // Diff — xoá cái cũ không còn, add cái mới
    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId: id } }),
      this.prisma.rolePermission.createMany({
        data: perms.map((p) => ({ roleId: id, permissionId: p.id })),
        skipDuplicates: true,
      }),
    ]);

    await this.permissions.reloadRole(id);
    return this.get(id);
  }
}

function toResponse(r: RoleWithRel): RoleResponseDto {
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    description: r.description,
    isSystem: r.isSystem,
    permissions: r.permissions.map((rp) => rp.permission.code),
    userCount: r._count.users,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}
