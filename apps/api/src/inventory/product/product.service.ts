import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Paginated, paginate } from '../../common/pagination/pagination.dto';
import { AppConfig } from '../../config/app.config';
import { agingDays } from '../velocity/velocity.util';
import { QueryProductDto, UpdateProductCrmDto } from './dto/product.dto';

@Injectable()
export class ProductService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cfg: AppConfig,
  ) {}

  async list(query: QueryProductDto): Promise<Paginated<unknown>> {
    const where: Prisma.ProductWhereInput = {};
    if (query.search) {
      where.OR = [
        { code: { contains: query.search, mode: 'insensitive' } },
        { name: { contains: query.search, mode: 'insensitive' } },
        { barcode: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.variantGroupId) where.variantGroupId = query.variantGroupId;
    if (query.tag?.length) where.tags = { hasEvery: query.tag };

    if (query.attr?.length) {
      const attrFilters = parseAttrFilters(query.attr);
      for (const [key, val] of Object.entries(attrFilters)) {
        (where as Prisma.ProductWhereInput).AND = [
          ...((where as { AND?: Prisma.ProductWhereInput[] }).AND ?? []),
          { attributes: { path: [key], equals: val } },
        ];
      }
    }

    // Stock filters join ProductStock
    const stockFilter: Prisma.ProductStockWhereInput = {};
    let useStock = false;
    if (query.branchId) {
      stockFilter.branchId = query.branchId;
      useStock = true;
    }
    if (query.velocityTag) {
      stockFilter.velocityTag = query.velocityTag;
      useStock = true;
    }
    if (query.agingGte !== undefined) {
      const cutoff = new Date(Date.now() - query.agingGte * 86_400_000);
      stockFilter.lastStockIncreaseAt = { lt: cutoff };
      stockFilter.onHand = { gt: 0 };
      useStock = true;
    }
    if (useStock) where.stocks = { some: stockFilter };

    const [rows, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: {
          category: { select: { id: true, name: true } },
          variantGroup: { select: { id: true, name: true } },
          images: { orderBy: { order: 'asc' }, take: 1 },
          stocks: query.branchId ? { where: { branchId: query.branchId }, take: 1 } : true,
        },
        orderBy: { id: 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.product.count({ where }),
    ]);

    let data = rows.map(toListResponse);

    // belowMin cần post-filter vì cross row Product × Product.minStock
    if (query.belowMin && query.branchId) {
      data = data.filter(
        (p) => p.minStock !== null && p.stockAtBranch !== null && p.stockAtBranch < p.minStock,
      );
    }

    return paginate(data, total, query);
  }

  async get(id: number) {
    const p = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        variantGroup: true,
        images: { orderBy: { order: 'asc' } },
        stocks: { include: { branch: { select: { id: true, name: true } } } },
      },
    });
    if (!p) throw new NotFoundException(`Product ${id} not found`);

    const now = new Date();
    return {
      ...p,
      externalId: p.externalId.toString(),
      masterProductId: p.masterProductId?.toString() ?? null,
      basePrice: Number(p.basePrice),
      costPrice: Number(p.costPrice),
      stocks: p.stocks.map((s) => ({
        branch: s.branch,
        onHand: s.onHand,
        reserved: s.reserved,
        velocity30d: s.velocity30d,
        reorderPoint: s.reorderPoint,
        velocityTag: s.velocityTag,
        agingDays: agingDays(s.lastStockIncreaseAt, now),
      })),
    };
  }

  async updateCrm(id: number, dto: UpdateProductCrmDto) {
    await this.ensureExists(id);
    const data: Prisma.ProductUpdateInput = {};
    if (dto.description !== undefined) data.description = dto.description ?? null;
    if (dto.tags !== undefined) data.tags = { set: dto.tags };
    if (dto.attributes !== undefined)
      data.attributes = (dto.attributes ?? {}) as Prisma.InputJsonValue;
    if (dto.minStock !== undefined) data.minStock = dto.minStock;
    if (dto.isTracked !== undefined) data.isTracked = dto.isTracked;
    if (dto.variantGroupId !== undefined) {
      data.variantGroup = dto.variantGroupId
        ? { connect: { id: dto.variantGroupId } }
        : { disconnect: true };
    }
    return this.prisma.product.update({ where: { id }, data });
  }

  private async ensureExists(id: number): Promise<void> {
    const p = await this.prisma.product.findUnique({ where: { id }, select: { id: true } });
    if (!p) throw new NotFoundException(`Product ${id} not found`);
  }
}

function parseAttrFilters(attrs: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const a of attrs) {
    const [k, ...rest] = a.split(':');
    if (!k || !rest.length) continue;
    out[k.trim()] = rest.join(':').trim();
  }
  return out;
}

type ProductListRow = Prisma.ProductGetPayload<{
  include: {
    category: { select: { id: true; name: true } };
    variantGroup: { select: { id: true; name: true } };
    images: true;
    stocks: true;
  };
}>;

function toListResponse(p: ProductListRow) {
  const stockAtBranch = p.stocks.length === 1 ? p.stocks[0].onHand : null;
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    basePrice: Number(p.basePrice),
    costPrice: Number(p.costPrice),
    barcode: p.barcode,
    tags: p.tags,
    attributes: p.attributes,
    category: p.category,
    variantGroup: p.variantGroup,
    minStock: p.minStock,
    isTracked: p.isTracked,
    primaryImage: p.images[0] ? { url: p.images[0].url, caption: p.images[0].caption } : null,
    totalOnHand: p.stocks.reduce((acc, s) => acc + s.onHand, 0),
    stockAtBranch,
  };
}
