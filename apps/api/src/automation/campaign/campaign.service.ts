import {
  BadRequestException,
  Injectable,
  NotFoundException,
  forwardRef,
  Inject,
} from '@nestjs/common';
import { Campaign, CampaignType, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Paginated, paginate } from '../../common/pagination/pagination.dto';
import { RuleRegistry } from '../rules/rule.registry';
import { AutomationScheduler } from '../automation.scheduler';
import { CreateCampaignDto, QueryCampaignDto, UpdateCampaignDto } from './dto/campaign.dto';

@Injectable()
export class CampaignService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rules: RuleRegistry,
    @Inject(forwardRef(() => AutomationScheduler))
    private readonly scheduler: AutomationScheduler,
  ) {}

  async list(query: QueryCampaignDto): Promise<Paginated<Campaign>> {
    const where: Prisma.CampaignWhereInput = {};
    if (query.type) where.type = query.type;
    if (query.isActive !== undefined) where.isActive = query.isActive;

    const [rows, total] = await Promise.all([
      this.prisma.campaign.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.campaign.count({ where }),
    ]);
    return paginate(rows, total, query);
  }

  async get(id: number): Promise<Campaign> {
    const c = await this.prisma.campaign.findUnique({ where: { id } });
    if (!c) throw new NotFoundException(`Campaign ${id} not found`);
    return c;
  }

  async create(dto: CreateCampaignDto): Promise<Campaign> {
    this.validateInvariants(dto);
    this.rules.get(dto.ruleCode); // throws if unknown

    const c = await this.prisma.campaign.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        type: dto.type,
        ruleCode: dto.ruleCode,
        conditions: (dto.conditions ?? {}) as Prisma.InputJsonValue,
        templateId: dto.templateId,
        fallbackTemplateId: dto.fallbackTemplateId ?? null,
        allowFallback: dto.allowFallback ?? false,
        schedule: dto.schedule ?? null,
        requiresApproval: applyApprovalRule(dto.type, dto.requiresApproval),
        refreshOnApprove: dto.refreshOnApprove ?? false,
        isActive: dto.isActive ?? true,
      },
    });
    this.scheduler.register(c);
    return c;
  }

  async update(id: number, dto: UpdateCampaignDto): Promise<Campaign> {
    const existing = await this.get(id);
    if (dto.ruleCode) this.rules.get(dto.ruleCode);

    const merged = { ...existing, ...dto } as CreateCampaignDto & {
      type: CampaignType;
    };
    this.validateInvariants(merged);

    const data: Prisma.CampaignUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description ?? null;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.ruleCode !== undefined) data.ruleCode = dto.ruleCode;
    if (dto.conditions !== undefined)
      data.conditions = (dto.conditions ?? {}) as Prisma.InputJsonValue;
    if (dto.templateId !== undefined) data.template = { connect: { id: dto.templateId } };
    if (dto.fallbackTemplateId !== undefined) {
      data.fallbackTemplate = dto.fallbackTemplateId
        ? { connect: { id: dto.fallbackTemplateId } }
        : { disconnect: true };
    }
    if (dto.allowFallback !== undefined) data.allowFallback = dto.allowFallback;
    if (dto.schedule !== undefined) data.schedule = dto.schedule ?? null;
    if (dto.requiresApproval !== undefined || dto.type !== undefined) {
      data.requiresApproval = applyApprovalRule(
        dto.type ?? existing.type,
        dto.requiresApproval ?? existing.requiresApproval,
      );
    }
    if (dto.refreshOnApprove !== undefined) data.refreshOnApprove = dto.refreshOnApprove;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const updated = await this.prisma.campaign.update({ where: { id }, data });
    await this.scheduler.reload(id);
    return updated;
  }

  async remove(id: number): Promise<void> {
    await this.get(id);
    this.scheduler.unregister(id);
    await this.prisma.campaign.delete({ where: { id } });
  }

  /**
   * Enforce business rules trên type × requiresApproval × schedule.
   */
  private validateInvariants(dto: Partial<CreateCampaignDto> & { type: CampaignType }): void {
    if (dto.type === CampaignType.RECURRING && !dto.schedule) {
      throw new BadRequestException('RECURRING campaign must have a cron schedule');
    }
    if (dto.type === CampaignType.ONE_OFF && dto.schedule) {
      throw new BadRequestException('ONE_OFF campaign must not have schedule');
    }
    if (dto.type === CampaignType.TRIGGERED && dto.schedule) {
      throw new BadRequestException('TRIGGERED campaign must not have schedule');
    }
  }
}

/**
 * ONE_OFF → buộc duyệt; TRIGGERED → cứng không duyệt; RECURRING → tuỳ DTO (default true).
 */
function applyApprovalRule(type: CampaignType, requested: boolean | undefined): boolean {
  if (type === CampaignType.ONE_OFF) return true;
  if (type === CampaignType.TRIGGERED) return false;
  return requested ?? true;
}
