import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../common/prisma/prisma.service';
import { Paginated, paginate, PaginationQueryDto } from '../common/pagination/pagination.dto';
import { AuthService } from '../auth/auth.service';
import { CreateUserDto, ResetPasswordDto, UpdateUserDto, UserResponseDto } from './dto/user.dto';

type UserWithRel = Prisma.UserGetPayload<{
  include: {
    roleRef: { select: { code: true; name: true } };
    branch: { select: { name: true } };
  };
}>;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  async list(query: PaginationQueryDto & { search?: string }): Promise<Paginated<UserResponseDto>> {
    const where: Prisma.UserWhereInput = {};
    if (query.search) {
      where.OR = [
        { email: { contains: query.search, mode: 'insensitive' } },
        { fullName: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: {
          roleRef: { select: { code: true, name: true } },
          branch: { select: { name: true } },
        },
        orderBy: { id: 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.user.count({ where }),
    ]);
    return paginate(rows.map(toResponse), total, query);
  }

  async get(id: number): Promise<UserResponseDto> {
    const u = await this.prisma.user.findUnique({
      where: { id },
      include: {
        roleRef: { select: { code: true, name: true } },
        branch: { select: { name: true } },
      },
    });
    if (!u) throw new NotFoundException(`User ${id} not found`);
    return toResponse(u);
  }

  async create(dto: CreateUserDto): Promise<UserResponseDto> {
    const role = await this.prisma.role.findUnique({ where: { id: dto.roleId } });
    if (!role) throw new BadRequestException(`Role ${dto.roleId} not found`);

    const email = dto.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException(`Email ${email} đã tồn tại`);

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const u = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName: dto.fullName,
        roleId: dto.roleId,
        role: mapRoleCodeToEnum(role.code),
        branchId: dto.branchId ?? null,
        isActive: dto.isActive ?? true,
      },
      include: {
        roleRef: { select: { code: true, name: true } },
        branch: { select: { name: true } },
      },
    });
    return toResponse(u);
  }

  async update(id: number, dto: UpdateUserDto, actorId: number): Promise<UserResponseDto> {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`User ${id} not found`);

    const data: Prisma.UserUpdateInput = {};
    if (dto.email !== undefined && dto.email.toLowerCase() !== existing.email) {
      const dup = await this.prisma.user.findUnique({
        where: { email: dto.email.toLowerCase() },
      });
      if (dup && dup.id !== id) throw new ConflictException('Email đã tồn tại');
      data.email = dto.email.toLowerCase();
    }
    if (dto.fullName !== undefined) data.fullName = dto.fullName;
    if (dto.isActive !== undefined) {
      if (dto.isActive === false && id === actorId) {
        throw new ForbiddenException('Không thể tự deactivate chính mình');
      }
      data.isActive = dto.isActive;
    }
    if (dto.branchId !== undefined) {
      data.branch = dto.branchId ? { connect: { id: dto.branchId } } : { disconnect: true };
    }
    if (dto.roleId !== undefined) {
      const role = await this.prisma.role.findUnique({ where: { id: dto.roleId } });
      if (!role) throw new BadRequestException(`Role ${dto.roleId} not found`);
      data.roleRef = { connect: { id: role.id } };
      data.role = mapRoleCodeToEnum(role.code);
    }
    if (dto.password) {
      data.passwordHash = await bcrypt.hash(dto.password, 10);
      // Đổi password → thu hồi hết refresh token cũ
      await this.auth.logout(id);
    }

    const u = await this.prisma.user.update({
      where: { id },
      data,
      include: {
        roleRef: { select: { code: true, name: true } },
        branch: { select: { name: true } },
      },
    });
    return toResponse(u);
  }

  async resetPassword(id: number, dto: ResetPasswordDto, actorId: number): Promise<void> {
    const u = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!u) throw new NotFoundException(`User ${id} not found`);
    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({ where: { id }, data: { passwordHash } });
    // Thu hồi refresh token để ép user login lại với password mới
    await this.auth.logout(id);
  }

  async toggleActive(id: number, actorId: number): Promise<UserResponseDto> {
    const u = await this.prisma.user.findUnique({ where: { id } });
    if (!u) throw new NotFoundException(`User ${id} not found`);
    if (id === actorId && u.isActive) {
      throw new ForbiddenException('Không thể tự deactivate chính mình');
    }
    const next = !u.isActive;
    const updated = await this.prisma.user.update({
      where: { id },
      data: { isActive: next },
      include: {
        roleRef: { select: { code: true, name: true } },
        branch: { select: { name: true } },
      },
    });
    if (!next) await this.auth.logout(id); // kick user
    return toResponse(updated);
  }

  async remove(id: number, actorId: number): Promise<void> {
    if (id === actorId) throw new ForbiddenException('Không thể tự xoá chính mình');
    const u = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!u) throw new NotFoundException(`User ${id} not found`);
    await this.auth.logout(id);
    await this.prisma.user.delete({ where: { id } });
  }
}

function toResponse(u: UserWithRel): UserResponseDto {
  return {
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    role: u.role,
    roleId: u.roleId,
    roleName: u.roleRef?.name ?? null,
    branchId: u.branchId,
    branchName: u.branch?.name ?? null,
    isActive: u.isActive,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}

/** Map role code → legacy UserRole enum (để giữ backward compat). */
function mapRoleCodeToEnum(code: string): UserRole {
  if (code === 'admin') return UserRole.ADMIN;
  if (code === 'manager') return UserRole.MANAGER;
  return UserRole.STAFF; // custom role mặc định map STAFF
}
