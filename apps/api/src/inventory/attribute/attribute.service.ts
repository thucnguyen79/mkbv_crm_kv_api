import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AttributeDefinition, AttributeKind, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface CreateAttributeDto {
  code: string;
  label: string;
  kind: AttributeKind;
  options?: unknown;
  isActive?: boolean;
}

@Injectable()
export class AttributeService {
  constructor(private readonly prisma: PrismaService) {}

  list(): Promise<AttributeDefinition[]> {
    return this.prisma.attributeDefinition.findMany({ orderBy: { label: 'asc' } });
  }

  async create(dto: CreateAttributeDto): Promise<AttributeDefinition> {
    try {
      return await this.prisma.attributeDefinition.create({
        data: {
          code: dto.code,
          label: dto.label,
          kind: dto.kind,
          options: (dto.options ?? null) as Prisma.InputJsonValue,
          isActive: dto.isActive ?? true,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException(`Attribute code ${dto.code} already exists`);
      }
      throw err;
    }
  }

  async update(id: number, dto: Partial<CreateAttributeDto>): Promise<AttributeDefinition> {
    await this.ensureExists(id);
    return this.prisma.attributeDefinition.update({
      where: { id },
      data: {
        code: dto.code,
        label: dto.label,
        kind: dto.kind,
        options: dto.options === undefined ? undefined : ((dto.options ?? null) as Prisma.InputJsonValue),
        isActive: dto.isActive,
      },
    });
  }

  async remove(id: number): Promise<void> {
    await this.ensureExists(id);
    await this.prisma.attributeDefinition.delete({ where: { id } });
  }

  private async ensureExists(id: number): Promise<void> {
    const a = await this.prisma.attributeDefinition.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!a) throw new NotFoundException(`Attribute ${id} not found`);
  }
}
