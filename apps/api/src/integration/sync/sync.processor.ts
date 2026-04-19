import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { SyncJobData, SyncService, SYNC_QUEUE_NAME } from './sync.service';
import { SyncCancelledError } from './strategies/sync-strategy.interface';

@Processor(SYNC_QUEUE_NAME, { concurrency: 1 })
export class SyncProcessor extends WorkerHost {
  private readonly logger = new Logger(SyncProcessor.name);

  constructor(private readonly syncService: SyncService) {
    super();
  }

  async process(job: Job<SyncJobData>): Promise<void> {
    const { entity } = job.data;
    this.logger.log(`▶ run ${entity} (jobId=${job.id}, attempt=${job.attemptsMade + 1})`);

    const controller = new AbortController();
    this.syncService.registerActive(entity, controller);
    try {
      await this.syncService.runOne(entity, controller.signal);
    } catch (err) {
      if (err instanceof SyncCancelledError) {
        // Cancelled → không throw lại (không retry). Cursor đã markCancelled.
        this.logger.warn(`✋ ${entity} cancelled`);
        return;
      }
      throw err;
    } finally {
      this.syncService.unregisterActive(entity);
    }
  }
}
