import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Customer, LoyaltyAccount, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { Paginated, paginate } from '../common/pagination/pagination.dto';
import { normalizePhone } from '../integration/sync/phone.util';
import { QueryCustomerDto } from './dto/query-customer.dto';
import {
  CreateCustomerDto,
  CustomerResponseDto,
  UpdateCustomerDto,
} from './dto/customer.dto';

type CustomerWithLoyalty = Customer & { loyalty: LoyaltyAccount | null };

@Injectable()
export class CustomerService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: QueryCustomerDto): Promise<Paginated<CustomerResponseDto>> {
    const where = this.buildWhere(query);
    const [rows, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        include: { loyalty: true },
        orderBy: [{ lastPurchaseAt: 'desc' }, { id: 'desc' }],
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.customer.count({ where }),
    ]);
    return paginate(rows.map(toResponse), total, query);
  }

  async get(id: number): Promise<CustomerResponseDto> {
    const c = await this.prisma.customer.findUnique({
      where: { id },
      include: { loyalty: true },
    });
    if (!c) throw new NotFoundException(`Customer ${id} not found`);
    return toResponse(c);
  }

  async create(dto: CreateCustomerDto): Promise<CustomerResponseDto> {
    const phone = normalizePhone(dto.phone);
    if (!phone) throw new BadRequestException('Invalid phone number');

    const existing = await this.prisma.customer.findUnique({
      where: { phone },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException(`Customer with phone ${phone} already exists (id=${existing.id})`);
    }

    const row = await this.prisma.customer.create({
      data: {
        name: dto.name,
        phone,
        email: dto.email?.toLowerCase(),
        gender: dto.gender,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
        address: dto.address,
        branchId: dto.branchId,
        note: dto.note,
        loyalty: { create: {} }, // auto-create loyalty account
      },
      include: { loyalty: true },
    });
    return toResponse(row);
  }

  async update(id: number, dto: UpdateCustomerDto): Promise<CustomerResponseDto> {
    await this.ensureExists(id);
    const data: Prisma.CustomerUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.phone !== undefined) {
      const phone = normalizePhone(dto.phone);
      if (!phone) throw new BadRequestException('Invalid phone number');
      data.phone = phone;
    }
    if (dto.email !== undefined) data.email = dto.email?.toLowerCase() ?? null;
    if (dto.gender !== undefined) data.gender = dto.gender;
    if (dto.birthDate !== undefined) data.birthDate = dto.birthDate ? new Date(dto.birthDate) : null;
    if (dto.address !== undefined) data.address = dto.address ?? null;
    if (dto.branchId !== undefined) {
      data.branch = dto.branchId ? { connect: { id: dto.branchId } } : { disconnect: true };
    }
    if (dto.note !== undefined) data.note = dto.note ?? null;

    const row = await this.prisma.customer.update({
      where: { id },
      data,
      include: { loyalty: true },
    });
    return toResponse(row);
  }

  async remove(id: number): Promise<void> {
    await this.ensureExists(id);
    await this.prisma.customer.delete({ where: { id } });
  }

  private async ensureExists(id: number): Promise<void> {
    const exists = await this.prisma.customer.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException(`Customer ${id} not found`);
  }

  private buildWhere(query: QueryCustomerDto): Prisma.CustomerWhereInput {
    // Soft-delete: mặc định không hiện customer đã xoá ở KV
    const where: Prisma.CustomerWhereInput = { deletedAt: null };
    if (query.search) {
      const s = query.search.trim();
      const phoneGuess = normalizePhone(s);
      where.OR = [
        { name: { contains: s, mode: 'insensitive' } },
        { phone: { contains: phoneGuess ?? s } },
      ];
    }
    if (query.branchId) where.branchId = query.branchId;
    if (query.tier) where.loyalty = { tier: query.tier };
    return where;
  }
}

function toResponse(c: CustomerWithLoyalty): CustomerResponseDto {
  return {
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email,
    gender: c.gender,
    birthDate: c.birthDate,
    address: c.address,
    branchId: c.branchId,
    totalSpent: Number(c.totalSpent),
    lastPurchaseAt: c.lastPurchaseAt,
    tier: c.loyalty?.tier ?? null,
    points: c.loyalty?.points ?? 0,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}
