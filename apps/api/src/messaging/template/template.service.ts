import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MessageTemplate, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  CreateTemplateDto,
  TemplateResponseDto,
  UpdateTemplateDto,
} from '../dto/template.dto';
import { extractVariables } from './template.util';

@Injectable()
export class TemplateService {
  constructor(private readonly prisma: PrismaService) {}

  list(): Promise<TemplateResponseDto[]> {
    return this.prisma.messageTemplate
      .findMany({ orderBy: [{ channel: 'asc' }, { code: 'asc' }] })
      .then((rows) => rows.map(toResponse));
  }

  async getByCode(code: string): Promise<MessageTemplate> {
    const t = await this.prisma.messageTemplate.findUnique({ where: { code } });
    if (!t) throw new NotFoundException(`Template ${code} not found`);
    return t;
  }

  async create(dto: CreateTemplateDto): Promise<TemplateResponseDto> {
    try {
      const row = await this.prisma.messageTemplate.create({
        data: {
          code: dto.code,
          channel: dto.channel,
          name: dto.name,
          body: dto.body,
          providerTemplateId: dto.providerTemplateId ?? null,
          variables: (dto.variables ?? {}) as Prisma.InputJsonValue,
          isActive: dto.isActive ?? true,
        },
      });
      return toResponse(row);
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException(`Template code ${dto.code} already exists`);
      }
      throw err;
    }
  }

  async update(id: number, dto: UpdateTemplateDto): Promise<TemplateResponseDto> {
    await this.ensureExists(id);
    const data: Prisma.MessageTemplateUpdateInput = {};
    if (dto.code !== undefined) data.code = dto.code;
    if (dto.channel !== undefined) data.channel = dto.channel;
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.body !== undefined) data.body = dto.body;
    if (dto.providerTemplateId !== undefined) data.providerTemplateId = dto.providerTemplateId ?? null;
    if (dto.variables !== undefined) data.variables = (dto.variables ?? {}) as Prisma.InputJsonValue;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    try {
      const row = await this.prisma.messageTemplate.update({ where: { id }, data });
      return toResponse(row);
    } catch (err) {
      if (isUniqueViolation(err)) throw new ConflictException(`Template code already exists`);
      throw err;
    }
  }

  async remove(id: number): Promise<void> {
    await this.ensureExists(id);
    await this.prisma.messageTemplate.delete({ where: { id } });
  }

  /** Dùng bởi MessagingService để validate trước khi enqueue. */
  async loadActiveByCode(code: string): Promise<MessageTemplate> {
    const t = await this.getByCode(code);
    if (!t.isActive) throw new BadRequestException(`Template ${code} is inactive`);
    return t;
  }

  private async ensureExists(id: number): Promise<void> {
    const t = await this.prisma.messageTemplate.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!t) throw new NotFoundException(`Template ${id} not found`);
  }
}

function toResponse(t: MessageTemplate): TemplateResponseDto {
  return {
    id: t.id,
    code: t.code,
    channel: t.channel,
    name: t.name,
    body: t.body,
    providerTemplateId: t.providerTemplateId,
    variables: t.variables,
    isActive: t.isActive,
    placeholders: extractVariables(t.body),
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}
