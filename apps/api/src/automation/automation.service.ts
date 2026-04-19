import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  Campaign,
  CampaignRunStatus,
  CampaignType,
  MessageStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { MessagingService } from '../messaging/messaging.service';
import { TemplateService } from '../messaging/template/template.service';
import { RuleRegistry } from './rules/rule.registry';
import { CustomerMatch } from './rules/rule.interface';
import { ORDER_SYNCED_EVENT, OrderSyncedEvent } from './events/order-synced.event';

export interface RunOptions {
  triggeredById?: number | null;
  customerIdHint?: number[]; // TRIGGERED: xét riêng các customer này
}

export interface DryRunResult {
  ruleCode: string;
  matchedCount: number;
  previewLimit: number;
  preview: CustomerMatch[];
}

@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rules: RuleRegistry,
    private readonly messaging: MessagingService,
    private readonly templates: TemplateService,
  ) {}

  async listRules() {
    return this.rules.list().map((r) => ({
      code: r.code,
      description: r.description,
      conditionsSchema: r.conditionsSchema,
    }));
  }

  /**
   * Match preview — không enqueue, không tạo CampaignRun. Dùng cho UI dry-run.
   */
  async dryRun(campaignId: number, previewLimit = 50): Promise<DryRunResult> {
    const campaign = await this.loadCampaign(campaignId);
    if (!campaign.ruleCode) throw new BadRequestException('Campaign has no ruleCode');
    const rule = this.rules.get(campaign.ruleCode);
    const matches = await rule.match({ campaign, now: new Date() });
    return {
      ruleCode: rule.code,
      matchedCount: matches.length,
      previewLimit,
      preview: matches.slice(0, previewLimit),
    };
  }

  /**
   * Run campaign:
   *  - match() → snapshot
   *  - if requiresApproval → tạo CampaignRun PENDING_APPROVAL, kết thúc ở đây
   *  - else → enqueue ngay + tạo CampaignRun EXECUTED
   */
  async runCampaign(
    campaignId: number,
    opts: RunOptions = {},
  ): Promise<{ runId: number; status: CampaignRunStatus; matchedCount: number }> {
    const campaign = await this.loadCampaign(campaignId);
    if (!campaign.isActive) throw new BadRequestException('Campaign is inactive');
    if (!campaign.ruleCode) throw new BadRequestException('Campaign has no ruleCode');
    if (!campaign.templateId) throw new BadRequestException('Campaign has no template');

    const rule = this.rules.get(campaign.ruleCode);
    const now = new Date();
    const matches = await rule.match({
      campaign,
      now,
      customerIdHint: opts.customerIdHint,
    });

    // TRIGGERED không dùng approval — enforce ở service (schema cho phép nhưng ignore).
    const skipApproval =
      campaign.type === CampaignType.TRIGGERED || !campaign.requiresApproval;

    const run = await this.prisma.campaignRun.create({
      data: {
        campaignId: campaign.id,
        status: skipApproval ? CampaignRunStatus.APPROVED : CampaignRunStatus.PENDING_APPROVAL,
        triggeredById: opts.triggeredById ?? null,
        matchedCount: matches.length,
        snapshot: matches as unknown as Prisma.InputJsonValue,
      },
    });

    if (skipApproval) {
      await this.executeRun(run.id);
      return { runId: run.id, status: CampaignRunStatus.EXECUTED, matchedCount: matches.length };
    }
    this.logger.log(
      `campaign=${campaign.id} run=${run.id} matched=${matches.length} → PENDING_APPROVAL`,
    );
    return {
      runId: run.id,
      status: CampaignRunStatus.PENDING_APPROVAL,
      matchedCount: matches.length,
    };
  }

  /** Manager duyệt — enqueue (có thể refresh match nếu campaign.refreshOnApprove). */
  async approve(runId: number, approvedById: number): Promise<void> {
    const run = await this.prisma.campaignRun.findUnique({
      where: { id: runId },
      include: { campaign: true },
    });
    if (!run) throw new NotFoundException(`Run ${runId} not found`);
    if (run.status !== CampaignRunStatus.PENDING_APPROVAL) {
      throw new BadRequestException(`Run ${runId} is not pending approval`);
    }

    await this.prisma.campaignRun.update({
      where: { id: runId },
      data: {
        status: CampaignRunStatus.APPROVED,
        approvedById,
        approvedAt: new Date(),
      },
    });
    await this.executeRun(runId);
  }

  async reject(runId: number, rejectedById: number, reason: string): Promise<void> {
    const run = await this.prisma.campaignRun.findUnique({ where: { id: runId } });
    if (!run) throw new NotFoundException(`Run ${runId} not found`);
    if (run.status !== CampaignRunStatus.PENDING_APPROVAL) {
      throw new BadRequestException(`Run ${runId} is not pending approval`);
    }
    await this.prisma.campaignRun.update({
      where: { id: runId },
      data: {
        status: CampaignRunStatus.REJECTED,
        approvedById: rejectedById,
        approvedAt: new Date(),
        rejectedReason: reason.slice(0, 500),
      },
    });
  }

  async cancel(runId: number, userId: number): Promise<void> {
    const run = await this.prisma.campaignRun.findUnique({ where: { id: runId } });
    if (!run) throw new NotFoundException(`Run ${runId} not found`);
    if (run.status !== CampaignRunStatus.PENDING_APPROVAL) {
      throw new BadRequestException(`Only pending runs can be cancelled`);
    }
    if (run.triggeredById && run.triggeredById !== userId) {
      throw new BadRequestException(`Only the creator can cancel this run`);
    }
    await this.prisma.campaignRun.update({
      where: { id: runId },
      data: { status: CampaignRunStatus.CANCELLED },
    });
  }

  /**
   * Thực thi 1 run đã APPROVED (hoặc skip-approval) — refresh nếu cần + enqueue.
   * Idempotency nhẹ: status != APPROVED thì bỏ qua.
   */
  private async executeRun(runId: number): Promise<void> {
    const run = await this.prisma.campaignRun.findUnique({
      where: { id: runId },
      include: { campaign: true },
    });
    if (!run) throw new NotFoundException(`Run ${runId} not found`);
    if (run.status !== CampaignRunStatus.APPROVED) {
      throw new BadRequestException(`Run ${runId} is not approved (status=${run.status})`);
    }
    const campaign = run.campaign;
    if (!campaign.templateId) throw new BadRequestException('Campaign has no template');

    let matches = run.snapshot as unknown as CustomerMatch[];
    if (campaign.refreshOnApprove) {
      const rule = this.rules.get(campaign.ruleCode!);
      matches = await rule.match({ campaign, now: new Date() });
      this.logger.log(`run=${runId} refreshed: ${matches.length} matches (was ${run.matchedCount})`);
    }

    const template = await this.templates.loadActiveByCode(
      (await this.prisma.messageTemplate.findUnique({ where: { id: campaign.templateId } }))!.code,
    );
    const fallbackTemplateCode = campaign.fallbackTemplateId
      ? (await this.prisma.messageTemplate.findUnique({
          where: { id: campaign.fallbackTemplateId },
        }))?.code ?? null
      : null;

    let enqueued = 0;
    for (const m of matches) {
      const exec = await this.prisma.campaignExecution.create({
        data: {
          campaignId: campaign.id,
          campaignRunId: runId,
          customerId: m.customerId,
          status: MessageStatus.QUEUED,
        },
      });
      try {
        await this.messaging.enqueue({
          customerId: m.customerId,
          phone: m.phone,
          channel: template.channel,
          template,
          variables: m.variables,
          allowFallback: campaign.allowFallback && !!fallbackTemplateCode,
          fallbackTemplateCode,
          campaignExecId: exec.id,
        });
        enqueued++;
      } catch (err) {
        this.logger.warn(
          `run=${runId} customer=${m.customerId} enqueue failed: ${(err as Error).message}`,
        );
        await this.prisma.campaignExecution.update({
          where: { id: exec.id },
          data: { status: MessageStatus.FAILED },
        });
      }
    }

    await this.prisma.campaignRun.update({
      where: { id: runId },
      data: {
        status: CampaignRunStatus.EXECUTED,
        executedAt: new Date(),
        enqueuedCount: enqueued,
        matchedCount: matches.length, // cập nhật nếu refresh thay đổi
      },
    });
    this.logger.log(`run=${runId} executed: enqueued=${enqueued}/${matches.length}`);
  }

  /** Handler cho TRIGGERED campaigns sau khi order sync batch xong. */
  @OnEvent(ORDER_SYNCED_EVENT)
  async onOrderSynced(ev: OrderSyncedEvent): Promise<void> {
    if (!ev.customerIds.length) return;
    const triggered = await this.prisma.campaign.findMany({
      where: { type: CampaignType.TRIGGERED, isActive: true },
      select: { id: true, name: true },
    });
    if (!triggered.length) return;
    this.logger.log(
      `order.synced → ${ev.customerIds.length} customer(s), ${triggered.length} triggered campaign(s)`,
    );
    for (const c of triggered) {
      try {
        await this.runCampaign(c.id, { customerIdHint: ev.customerIds });
      } catch (err) {
        this.logger.warn(`triggered campaign ${c.id} failed: ${(err as Error).message}`);
      }
    }
  }

  private async loadCampaign(id: number): Promise<Campaign> {
    const c = await this.prisma.campaign.findUnique({ where: { id } });
    if (!c) throw new NotFoundException(`Campaign ${id} not found`);
    return c;
  }
}
