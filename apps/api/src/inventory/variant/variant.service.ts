import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface CreateVariantGroupDto {
  code: string;
  name: string;
  description?: string | null;
}

@Injectable()
export class VariantGroupService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const groups = await this.prisma.productVariantGroup.findMany({
      orderBy: { id: 'desc' },
      include: {
        _count: { select: { products: true } },
      },
    });
    return groups.map((g) => ({
      id: g.id,
      code: g.code,
      name: g.name,
      description: g.description,
      productCount: g._count.products,
      createdAt: g.createdAt,
    }));
  }

  async get(id: number) {
    const g = await this.prisma.productVariantGroup.findUnique({
      where: { id },
      include: {
        products: {
          select: {
            id: true,
            code: true,
            name: true,
            basePrice: true,
            attributes: true,
            stocks: {
              select: { branchId: true, onHand: true },
            },
            images: {
              where: { isPrimary: true },
              take: 1,
              select: { url: true },
            },
          },
        },
      },
    });
    if (!g) throw new NotFoundException(`Variant group ${id} not found`);

    const variants = g.products.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      basePrice: Number(p.basePrice),
      attributes: p.attributes,
      totalOnHand: p.stocks.reduce((acc, s) => acc + s.onHand, 0),
      primaryImage: p.images[0]?.url ?? null,
    }));
    return {
      id: g.id,
      code: g.code,
      name: g.name,
      description: g.description,
      variants,
      totalOnHand: variants.reduce((acc, v) => acc + v.totalOnHand, 0),
    };
  }

  async create(dto: CreateVariantGroupDto) {
    try {
      return await this.prisma.productVariantGroup.create({
        data: {
          code: dto.code,
          name: dto.name,
          description: dto.description ?? null,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException(`Variant group code ${dto.code} already exists`);
      }
      throw err;
    }
  }

  async update(id: number, dto: Partial<CreateVariantGroupDto>) {
    await this.ensureExists(id);
    return this.prisma.productVariantGroup.update({
      where: { id },
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description ?? null,
      },
    });
  }

  async remove(id: number): Promise<void> {
    await this.ensureExists(id);
    // Prisma onDelete: SetNull trên Product.variantGroupId — SP giữ nguyên
    await this.prisma.productVariantGroup.delete({ where: { id } });
  }

  async addProducts(groupId: number, productIds: number[]): Promise<void> {
    await this.ensureExists(groupId);
    await this.prisma.product.updateMany({
      where: { id: { in: productIds } },
      data: { variantGroupId: groupId },
    });
  }

  async removeProducts(groupId: number, productIds: number[]): Promise<void> {
    await this.prisma.product.updateMany({
      where: { id: { in: productIds }, variantGroupId: groupId },
      data: { variantGroupId: null },
    });
  }

  private async ensureExists(id: number): Promise<void> {
    const g = await this.prisma.productVariantGroup.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!g) throw new NotFoundException(`Variant group ${id} not found`);
  }
}
