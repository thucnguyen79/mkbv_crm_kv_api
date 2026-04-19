import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { KiotVietService } from '../../kiotviet/kiotviet.service';
import { CursorService } from '../cursor.service';
import { SyncCancelledError, SyncResult, SyncStrategy } from './sync-strategy.interface';

@Injectable()
export class BranchSyncStrategy implements SyncStrategy {
  readonly entity = 'branch';
  private readonly logger = new Logger(BranchSyncStrategy.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kv: KiotVietService,
    private readonly cursor: CursorService,
  ) {}

  async run(signal?: AbortSignal): Promise<SyncResult> {
    const startedAt = new Date();
    await this.cursor.markRunning(this.entity, startedAt);
    try {
      const { data } = await this.kv.branches.list({ signal });
      for (const b of data) {
        if (signal?.aborted) {
          await this.cursor.markCancelled(this.entity);
          throw new SyncCancelledError();
        }
        await this.prisma.branch.upsert({
          where: { externalId: BigInt(b.id) },
          create: {
            externalId: BigInt(b.id),
            name: b.branchName,
            address: b.address ?? null,
            isActive: b.isActive ?? true,
          },
          update: {
            name: b.branchName,
            address: b.address ?? null,
            isActive: b.isActive ?? true,
          },
        });
      }
      await this.cursor.markSuccess(this.entity, startedAt, `synced=${data.length}`);
      this.logger.log(`✓ branches synced: ${data.length}`);
      return { entity: this.entity, synced: data.length, lastSyncedAt: startedAt };
    } catch (err) {
      if ((err as Error).name !== 'SyncCancelledError') {
        await this.cursor.markFailed(this.entity, (err as Error).message);
      }
      throw err;
    }
  }
}
