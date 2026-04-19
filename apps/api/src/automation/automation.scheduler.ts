import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Campaign, CampaignType } from '@prisma/client';
import { CronJob } from 'cron';
import { PrismaService } from '../common/prisma/prisma.service';
import { AutomationService } from './automation.service';

/**
 * Đăng ký 1 cron job cho mỗi RECURRING campaign active có schedule.
 * Khi campaign tạo/update/xoá, gọi reload(id) để re-register.
 */
@Injectable()
export class AutomationScheduler implements OnModuleInit {
  private readonly logger = new Logger(AutomationScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: SchedulerRegistry,
    private readonly automation: AutomationService,
  ) {}

  async onModuleInit(): Promise<void> {
    const campaigns = await this.prisma.campaign.findMany({
      where: { type: CampaignType.RECURRING, isActive: true, schedule: { not: null } },
    });
    for (const c of campaigns) this.register(c);
    this.logger.log(`Automation scheduler: ${campaigns.length} recurring campaign(s) armed`);
  }

  register(c: Campaign): void {
    if (c.type !== CampaignType.RECURRING || !c.isActive || !c.schedule) return;
    const name = jobName(c.id);
    this.unregister(c.id);
    try {
      const job = CronJob.from({
        cronTime: c.schedule,
        onTick: () => {
          this.automation.runCampaign(c.id, {}).catch((err) => {
            this.logger.error(`campaign ${c.id} run failed: ${err.message}`);
          });
        },
      });
      this.registry.addCronJob(name, job);
      job.start();
      this.logger.log(`→ campaign ${c.id} "${c.name}" armed: cron="${c.schedule}"`);
    } catch (err) {
      this.logger.error(`Failed to arm campaign ${c.id}: ${(err as Error).message}`);
    }
  }

  unregister(campaignId: number): void {
    const name = jobName(campaignId);
    try {
      if (this.registry.doesExist('cron', name)) {
        this.registry.deleteCronJob(name);
      }
    } catch (err) {
      this.logger.warn(`unregister ${name}: ${(err as Error).message}`);
    }
  }

  async reload(campaignId: number): Promise<void> {
    const c = await this.prisma.campaign.findUnique({ where: { id: campaignId } });
    this.unregister(campaignId);
    if (c) this.register(c);
  }
}

function jobName(id: number): string {
  return `campaign-${id}`;
}
