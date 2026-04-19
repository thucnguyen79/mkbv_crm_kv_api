import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { KiotVietService } from '../../kiotviet/kiotviet.service';
import { CursorService } from '../cursor.service';
import { SyncCancelledError, SyncResult, SyncStrategy } from './sync-strategy.interface';
import { KvCategory } from '../../kiotviet/dto/kiotviet.dto';

@Injectable()
export class CategorySyncStrategy implements SyncStrategy {
  readonly entity = 'category';
  private readonly logger = new Logger(CategorySyncStrategy.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kv: KiotVietService,
    private readonly cursor: CursorService,
  ) {}

  async run(signal?: AbortSignal): Promise<SyncResult> {
    const startedAt = new Date();
    await this.cursor.markRunning(this.entity, startedAt);
    try {
      const { data } = await this.kv.categories.list({}, { signal });
      const flat = flattenCategories(data);
      for (const c of flat) {
        if (signal?.aborted) {
          await this.cursor.markCancelled(this.entity);
          throw new SyncCancelledError();
        }
        await this.prisma.category.upsert({
          where: { externalId: BigInt(c.categoryId) },
          create: { externalId: BigInt(c.categoryId), name: c.categoryName },
          update: { name: c.categoryName },
        });
      }
      for (const c of flat) {
        if (signal?.aborted) {
          await this.cursor.markCancelled(this.entity);
          throw new SyncCancelledError();
        }
        if (!c.parentId) continue;
        const parent = await this.prisma.category.findUnique({
          where: { externalId: BigInt(c.parentId) },
          select: { id: true },
        });
        if (!parent) continue;
        await this.prisma.category.update({
          where: { externalId: BigInt(c.categoryId) },
          data: { parentId: parent.id },
        });
      }
      await this.cursor.markSuccess(this.entity, startedAt, `synced=${flat.length}`);
      this.logger.log(`✓ categories synced: ${flat.length}`);
      return { entity: this.entity, synced: flat.length, lastSyncedAt: startedAt };
    } catch (err) {
      if ((err as Error).name !== 'SyncCancelledError') {
        await this.cursor.markFailed(this.entity, (err as Error).message);
      }
      throw err;
    }
  }
}

function flattenCategories(nodes: (KvCategory & { children?: KvCategory[] })[]): KvCategory[] {
  const out: KvCategory[] = [];
  const walk = (list: (KvCategory & { children?: KvCategory[] })[]) => {
    for (const n of list) {
      out.push(n);
      if (n.children?.length) walk(n.children as (KvCategory & { children?: KvCategory[] })[]);
    }
  };
  walk(nodes);
  return out;
}
