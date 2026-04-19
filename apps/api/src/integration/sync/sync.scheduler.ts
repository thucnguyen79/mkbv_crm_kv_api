import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { AppConfig } from '../../config/app.config';
import { SyncService } from './sync.service';

/**
 * Register a single cron job from env at startup. Using SchedulerRegistry
 * directly (rather than @Cron) lets the cron pattern live in env so we can
 * change frequency without a redeploy.
 *
 * `cron` is a transitive dep of @nestjs/schedule — we import it explicitly
 * so TS can resolve the type.
 */
@Injectable()
export class SyncScheduler implements OnModuleInit {
  private readonly logger = new Logger(SyncScheduler.name);

  constructor(
    private readonly cfg: AppConfig,
    private readonly sync: SyncService,
    private readonly registry: SchedulerRegistry,
  ) {}

  onModuleInit(): void {
    if (!this.cfg.sync.enabled) {
      this.logger.warn('Sync scheduler disabled (SYNC_ENABLED=false)');
      return;
    }
    const job = CronJob.from({
      cronTime: this.cfg.sync.cron,
      onTick: () => {
        this.sync.enqueuePipeline().catch((err) => this.logger.error(err));
      },
    });
    this.registry.addCronJob('kiotviet-sync', job);
    job.start();
    this.logger.log(`Sync scheduler armed: cron="${this.cfg.sync.cron}"`);
  }
}
