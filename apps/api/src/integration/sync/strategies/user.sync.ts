import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { KiotVietService } from '../../kiotviet/kiotviet.service';
import { CursorService } from '../cursor.service';
import { SyncCancelledError, SyncResult, SyncStrategy } from './sync-strategy.interface';

@Injectable()
export class UserSyncStrategy implements SyncStrategy {
  readonly entity = 'user';
  private readonly logger = new Logger(UserSyncStrategy.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kv: KiotVietService,
    private readonly cursor: CursorService,
  ) {}

  async run(signal?: AbortSignal): Promise<SyncResult> {
    const startedAt = new Date();
    await this.cursor.markRunning(this.entity, startedAt);
    try {
      const { data } = await this.kv.users.list({ signal });
      let synced = 0;
      for (const u of data) {
        if (signal?.aborted) {
          await this.cursor.markCancelled(this.entity);
          throw new SyncCancelledError();
        }
        const email = u.email?.toLowerCase() || `kv-user-${u.id}@kiotviet.local`;
        await this.prisma.user.upsert({
          where: { externalId: BigInt(u.id) },
          create: {
            externalId: BigInt(u.id),
            email,
            fullName: u.givenName || u.userName,
            passwordHash: '!kiotviet-imported',
            isActive: true,
          },
          update: {
            email,
            fullName: u.givenName || u.userName,
          },
        });
        synced++;
      }
      await this.cursor.markSuccess(this.entity, startedAt, `synced=${synced}`);
      this.logger.log(`✓ users synced: ${synced}`);
      return { entity: this.entity, synced, lastSyncedAt: startedAt };
    } catch (err) {
      if ((err as Error).name !== 'SyncCancelledError') {
        await this.cursor.markFailed(this.entity, (err as Error).message);
      }
      throw err;
    }
  }
}
