import { Injectable } from '@nestjs/common';
import { SyncCursor } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

export type SyncStatus = 'running' | 'success' | 'failed' | 'cancelled';

export interface ResumeState {
  since: Date; // `lastModifiedFrom` để query KV
  offset: number; // currentItem bắt đầu
  isResume: boolean; // true nếu đang tiếp tục dở dang
}

@Injectable()
export class CursorService {
  constructor(private readonly prisma: PrismaService) {}

  get(entity: string): Promise<SyncCursor | null> {
    return this.prisma.syncCursor.findUnique({ where: { entity } });
  }

  listAll(): Promise<SyncCursor[]> {
    return this.prisma.syncCursor.findMany({ orderBy: { entity: 'asc' } });
  }

  /**
   * Trả về state để strategy bắt đầu run:
   *  - Nếu có checkpoint (run trước dở dang): dùng `checkpointSince` + `checkpointOffset`
   *  - Nếu không: `since = lastSyncedAt ?? epoch`, `offset = 0` (fresh run)
   */
  async getResumeState(entity: string): Promise<ResumeState> {
    const c = await this.get(entity);
    if (c?.checkpointSince) {
      return {
        since: c.checkpointSince,
        offset: c.checkpointOffset,
        isResume: true,
      };
    }
    return {
      since: c?.lastSyncedAt ?? new Date(0),
      offset: 0,
      isResume: false,
    };
  }

  /**
   * Đánh dấu running. Nếu có checkpoint cũ (run trước fail/cancel) → giữ nguyên.
   * Ngược lại tạo checkpoint mới với `since` này (để resume khớp pagination).
   */
  async markRunning(entity: string, since: Date): Promise<void> {
    const existing = await this.get(entity);
    const keepCheckpoint = !!existing?.checkpointSince;
    await this.prisma.syncCursor.upsert({
      where: { entity },
      create: {
        entity,
        status: 'running',
        lastRunAt: new Date(),
        note: null,
        checkpointSince: since,
        checkpointOffset: 0,
      },
      update: {
        status: 'running',
        lastRunAt: new Date(),
        note: null,
        checkpointSince: keepCheckpoint ? existing!.checkpointSince : since,
        checkpointOffset: keepCheckpoint ? existing!.checkpointOffset : 0,
      },
    });
  }

  /** Ghi offset sau mỗi page thành công — resume point cho lần sau nếu fail. */
  async updateCheckpoint(entity: string, offset: number): Promise<void> {
    await this.prisma.syncCursor.update({
      where: { entity },
      data: { checkpointOffset: offset },
    });
  }

  /** Run hoàn tất — clear checkpoint, update lastSyncedAt. */
  async markSuccess(entity: string, lastSyncedAt: Date, note?: string): Promise<void> {
    await this.prisma.syncCursor.update({
      where: { entity },
      data: {
        status: 'success',
        lastSyncedAt,
        note: note ?? null,
        checkpointSince: null,
        checkpointOffset: 0,
      },
    });
  }

  /** Fail — GIỮ checkpoint để lần sau resume. */
  async markFailed(entity: string, note: string): Promise<void> {
    await this.prisma.syncCursor.update({
      where: { entity },
      data: { status: 'failed', note: note.slice(0, 500) },
    });
  }

  /** Cancel (user bấm Dừng) — GIỮ checkpoint để lần sau resume. */
  async markCancelled(entity: string, note = 'Cancelled'): Promise<void> {
    await this.prisma.syncCursor.update({
      where: { entity },
      data: { status: 'cancelled', note: note.slice(0, 500) },
    });
  }

  /** Admin chủ động xoá checkpoint để next run chạy lại full từ lastSyncedAt. */
  async clearCheckpoint(entity: string): Promise<void> {
    await this.prisma.syncCursor.update({
      where: { entity },
      data: { checkpointSince: null, checkpointOffset: 0 },
    });
  }

  /**
   * Reset full: clear `lastSyncedAt` + checkpoint. Lần sync kế tiếp pull toàn
   * bộ data (lastModifiedFrom = epoch). Dùng để fix record bị sai FK link do
   * chạy sai thứ tự, hoặc khi đổi logic mapping.
   */
  async resetCursor(entity: string): Promise<void> {
    await this.prisma.syncCursor.update({
      where: { entity },
      data: {
        lastSyncedAt: null,
        checkpointSince: null,
        checkpointOffset: 0,
        status: null,
        note: null,
      },
    });
  }
}
