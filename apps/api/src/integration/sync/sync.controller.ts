import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../auth/decorators/roles.decorator';
import { SyncService } from './sync.service';

/**
 * LƯU Ý thứ tự: NestJS match route theo thứ tự khai báo. Static paths
 * (`stop`, `pipeline/run`, `reset-all-cursors`, ...) phải đứng TRƯỚC
 * dynamic patterns (`:entity/run`, `:entity/cancel`, ...) để không bị
 * nuốt với entity='pipeline' / 'stop' / 'cancel-all'.
 */
@ApiTags('sync')
@ApiBearerAuth()
@Controller({ path: 'sync', version: '1' })
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  // ===== Static routes — KHÔNG có :entity =====

  @Get('status')
  @ApiOperation({ summary: 'Trạng thái sync mỗi entity (cursor + BullMQ queue state)' })
  async status() {
    const [cursors, paused, queueStates] = await Promise.all([
      this.sync.cursor.listAll(),
      this.sync.isPaused(),
      this.sync.getQueueStates(),
    ]);
    return {
      data: cursors.map((c) => ({
        entity: c.entity,
        status: c.status,
        queueState: queueStates[c.entity] ?? null,
        lastRunAt: c.lastRunAt,
        lastSyncedAt: c.lastSyncedAt,
        note: c.note,
        checkpointOffset: c.checkpointOffset,
        hasCheckpoint: !!c.checkpointSince,
      })),
      meta: { entities: this.sync.entities(), paused },
    };
  }

  @Post('pause')
  @Roles(UserRole.ADMIN)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Pause soft — queue tạm ngưng. Job đang chạy tiếp tục tới xong, job mới chờ',
  })
  async pause() {
    await this.sync.pauseQueue();
    return { ok: true, paused: true };
  }

  @Post('resume')
  @Roles(UserRole.ADMIN)
  @HttpCode(200)
  @ApiOperation({ summary: 'Mở lại queue' })
  async resume() {
    await this.sync.resumeAll();
    return { ok: true, paused: false };
  }

  @Post('stop')
  @Roles(UserRole.ADMIN)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Stop cứng — pause + abort running + xoá pending (legacy, prefer pause + cancel-all)',
  })
  stop() {
    return this.sync.stopAll();
  }

  @Post('cancel-all')
  @Roles(UserRole.ADMIN)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Huỷ tất cả job đang chạy/chờ, queue vẫn mở',
  })
  cancelAll() {
    return this.sync.cancelAll();
  }

  @Post('reset-all-cursors')
  @Roles(UserRole.ADMIN)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Reset full TẤT CẢ entity — pipeline kế tiếp pull toàn bộ data từ KV',
  })
  async resetAllCursors() {
    return this.sync.resetAllCursors();
  }

  @Post('pipeline/run')
  @Roles(UserRole.ADMIN)
  @HttpCode(202)
  @ApiOperation({ summary: 'Enqueue toàn bộ pipeline (branch → ... → invoice)' })
  async runPipeline() {
    await this.sync.enqueuePipeline();
    return { queued: 'pipeline', entities: this.sync.entities() };
  }

  // ===== Dynamic routes — CÓ :entity =====

  @Post(':entity/run')
  @Roles(UserRole.ADMIN)
  @HttpCode(202)
  @ApiOperation({ summary: 'Enqueue sync cho 1 entity (async qua BullMQ)' })
  async runEntity(@Param('entity') entity: string) {
    await this.sync.enqueueOne(entity);
    return { queued: entity };
  }

  @Post(':entity/cancel')
  @Roles(UserRole.ADMIN)
  @HttpCode(200)
  @ApiOperation({ summary: 'Huỷ job của 1 entity (abort active hoặc remove waiting)' })
  async cancelEntity(@Param('entity') entity: string) {
    return this.sync.cancelEntity(entity);
  }

  @Post(':entity/reset-checkpoint')
  @Roles(UserRole.ADMIN)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Xoá checkpoint — lần sync kế tiếp chạy fresh từ lastSyncedAt',
  })
  async resetCheckpoint(@Param('entity') entity: string) {
    await this.sync.resetCheckpoint(entity);
    return { ok: true };
  }

  @Post(':entity/reset-cursor')
  @Roles(UserRole.ADMIN)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Reset full 1 entity — clear lastSyncedAt + checkpoint',
  })
  async resetCursor(@Param('entity') entity: string) {
    await this.sync.resetCursor(entity);
    return { ok: true };
  }
}
