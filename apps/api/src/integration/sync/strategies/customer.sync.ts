import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { KiotVietService } from '../../kiotviet/kiotviet.service';
import { CursorService } from '../cursor.service';
import { SyncCancelledError, SyncResult, SyncStrategy } from './sync-strategy.interface';
import { normalizePhone } from '../phone.util';
import { chunkedBatch, SOFT_DELETE_CHUNK } from '../chunk.util';
import { KvCustomer } from '../../kiotviet/dto/kiotviet.dto';

const PAGE_SIZE = 100;

@Injectable()
export class CustomerSyncStrategy implements SyncStrategy {
  readonly entity = 'customer';
  private readonly logger = new Logger(CustomerSyncStrategy.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kv: KiotVietService,
    private readonly cursor: CursorService,
  ) {}

  async run(signal?: AbortSignal): Promise<SyncResult> {
    const startedAt = new Date();
    const resume = await this.cursor.getResumeState(this.entity);
    await this.cursor.markRunning(this.entity, resume.since);

    if (resume.isResume) {
      this.logger.log(
        `↺ resuming customer from offset=${resume.offset} since=${resume.since.toISOString()}`,
      );
    }

    try {
      let currentItem = resume.offset;
      let synced = 0;
      let skipped = 0;

      while (true) {
        if (signal?.aborted) {
          await this.cursor.markCancelled(this.entity);
          throw new SyncCancelledError();
        }
        const { data, total, removedIds } = await this.kv.customers.list(
          {
            currentItem,
            pageSize: PAGE_SIZE,
            lastModifiedFrom: resume.since.toISOString(),
          },
          { signal },
        );
        // Soft-delete customer KV đã xoá. Chunk vì removedIds có thể lên
        // vài chục nghìn — vượt limit 32767 bind variables của PostgreSQL.
        if (removedIds?.length) {
          const affected = await chunkedBatch(removedIds, SOFT_DELETE_CHUNK, (batch) =>
            this.prisma.customer.updateMany({
              where: {
                externalId: { in: batch.map((n) => BigInt(n)) },
                deletedAt: null,
              },
              data: { deletedAt: new Date() },
            }),
          );
          this.logger.log(`↓ soft-deleted ${affected}/${removedIds.length} customer(s)`);
        }
        if (!data.length) break;

        const branchExtIds = Array.from(
          new Set(data.map((c) => c.branchId).filter((x): x is number => !!x)),
        );
        const branches = branchExtIds.length
          ? await this.prisma.branch.findMany({
              where: { externalId: { in: branchExtIds.map((n) => BigInt(n)) } },
              select: { id: true, externalId: true },
            })
          : [];
        const branchMap = new Map(branches.map((b) => [Number(b.externalId), b.id]));

        for (const c of data) {
          const phone = normalizePhone(c.contactNumber);
          if (!phone) {
            skipped++;
            continue;
          }
          await this.upsertCustomer(c, phone, branchMap);
          synced++;
        }
        currentItem += data.length;
        await this.cursor.updateCheckpoint(this.entity, currentItem);
        if (currentItem >= total) break;
      }

      await this.cursor.markSuccess(this.entity, startedAt, `synced=${synced} skipped=${skipped}`);
      this.logger.log(`✓ customers synced: ${synced} (skipped ${skipped} no-phone)`);
      return { entity: this.entity, synced, skipped, lastSyncedAt: startedAt };
    } catch (err) {
      if ((err as Error).name !== 'SyncCancelledError') {
        await this.cursor.markFailed(this.entity, (err as Error).message);
      }
      throw err;
    }
  }

  private async upsertCustomer(
    c: KvCustomer,
    phone: string,
    branchMap: Map<number, number>,
  ): Promise<void> {
    const branchId = c.branchId ? (branchMap.get(c.branchId) ?? null) : null;
    const baseData = {
      externalId: BigInt(c.id),
      externalCode: c.code || null,
      name: c.name,
      phone,
      email: c.email?.toLowerCase() || null,
      gender: c.gender ?? null,
      birthDate: c.birthDate ? new Date(c.birthDate) : null,
      address: c.address || null,
      locationName: c.locationName || null,
      wardName: c.wardName || null,
      branchId,
      kvRewardPoint: c.rewardPoint ?? 0,
      note: c.comments || null,
      facebookPsid: c.psidFacebook || null,
    };

    const byExternal = await this.prisma.customer.findUnique({
      where: { externalId: baseData.externalId },
      select: { id: true, phone: true },
    });
    if (byExternal) {
      if (byExternal.phone !== phone) {
        const other = await this.prisma.customer.findUnique({
          where: { phone },
          select: { id: true },
        });
        if (other && other.id !== byExternal.id) {
          const { phone: _p, ...rest } = baseData;
          await this.prisma.customer.update({ where: { id: byExternal.id }, data: rest });
          return;
        }
      }
      await this.prisma.customer.update({ where: { id: byExternal.id }, data: baseData });
      return;
    }

    const byPhone = await this.prisma.customer.findUnique({
      where: { phone },
      select: { id: true },
    });
    if (byPhone) {
      await this.prisma.customer.update({ where: { id: byPhone.id }, data: baseData });
      return;
    }

    await this.prisma.customer.create({ data: baseData });
  }
}
