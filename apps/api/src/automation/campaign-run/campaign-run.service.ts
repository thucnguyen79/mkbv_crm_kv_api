import { Injectable, NotFoundException } from '@nestjs/common';
import { CampaignRun, CampaignRunStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Paginated, paginate, PaginationQueryDto } from '../../common/pagination/pagination.dto';

@Injectable()
export class CampaignRunService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    query: PaginationQueryDto & { status?: CampaignRunStatus; campaignId?: number },
  ): Promise<Paginated<CampaignRun>> {
    const where: Prisma.CampaignRunWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.campaignId) where.campaignId = query.campaignId;

    const [rows, total] = await Promise.all([
      this.prisma.campaignRun.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.take,
        include: { campaign: { select: { name: true, type: true } } },
      }),
      this.prisma.campaignRun.count({ where }),
    ]);
    return paginate(rows, total, query);
  }

  async get(id: number): Promise<CampaignRun> {
    const r = await this.prisma.campaignRun.findUnique({
      where: { id },
      include: { campaign: true },
    });
    if (!r) throw new NotFoundException(`Run ${id} not found`);
    return r;
  }
}
