import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { Paginated, paginate } from '../common/pagination/pagination.dto';
import { OrderResponseDto, QueryOrderDto } from './dto/order.dto';

@Injectable()
export class OrderService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: QueryOrderDto): Promise<Paginated<OrderResponseDto>> {
    const where = this.buildWhere(query);
    const [rows, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: { items: true, customer: { select: { name: true } } },
        orderBy: { purchasedAt: 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.order.count({ where }),
    ]);
    return paginate(rows.map(toResponse), total, query);
  }

  async get(id: number): Promise<OrderResponseDto> {
    const row = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true, customer: { select: { name: true } } },
    });
    if (!row) throw new NotFoundException(`Order ${id} not found`);
    return toResponse(row);
  }

  async listForCustomer(
    customerId: number,
    query: QueryOrderDto,
  ): Promise<Paginated<OrderResponseDto>> {
    return this.list({ ...query, customerId } as QueryOrderDto);
  }

  private buildWhere(query: QueryOrderDto): Prisma.OrderWhereInput {
    const where: Prisma.OrderWhereInput = { deletedAt: null };
    if (query.customerId) where.customerId = query.customerId;
    if (query.branchId) where.branchId = query.branchId;
    if (query.sourceType) where.sourceType = query.sourceType;
    if (query.status) where.status = query.status;
    if (query.from || query.to) {
      where.purchasedAt = {};
      if (query.from) (where.purchasedAt as Prisma.DateTimeFilter).gte = new Date(query.from);
      if (query.to) (where.purchasedAt as Prisma.DateTimeFilter).lte = new Date(query.to);
    }
    return where;
  }
}

type OrderWithRel = Prisma.OrderGetPayload<{
  include: { items: true; customer: { select: { name: true } } };
}>;

function toResponse(o: OrderWithRel): OrderResponseDto {
  return {
    id: o.id,
    externalCode: o.externalCode,
    sourceType: o.sourceType,
    customerId: o.customerId,
    customerName: o.customer?.name ?? null,
    branchId: o.branchId,
    totalAmount: Number(o.totalAmount),
    discount: Number(o.discount),
    status: o.status,
    purchasedAt: o.purchasedAt,
    items: o.items.map((it) => ({
      id: it.id,
      productId: it.productId,
      name: it.name,
      quantity: Number(it.quantity),
      price: Number(it.price),
      discount: Number(it.discount),
    })),
  };
}
