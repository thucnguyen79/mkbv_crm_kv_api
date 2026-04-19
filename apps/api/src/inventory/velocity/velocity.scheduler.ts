import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { AppConfig } from '../../config/app.config';
import { VelocityService } from './velocity.service';

@Injectable()
export class VelocityScheduler implements OnModuleInit {
  private readonly logger = new Logger(VelocityScheduler.name);

  constructor(
    private readonly cfg: AppConfig,
    private readonly velocity: VelocityService,
    private readonly registry: SchedulerRegistry,
  ) {}

  onModuleInit(): void {
    const job = CronJob.from({
      cronTime: this.cfg.inventory.velocityCron,
      onTick: () => {
        this.velocity
          .recomputeAll()
          .catch((err) => this.logger.error(`velocity recompute failed: ${err.message}`));
      },
    });
    this.registry.addCronJob('inventory-velocity', job);
    job.start();
    this.logger.log(`Velocity scheduler armed: cron="${this.cfg.inventory.velocityCron}"`);
  }
}
