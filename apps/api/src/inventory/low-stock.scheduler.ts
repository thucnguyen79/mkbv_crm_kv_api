import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { NotificationSeverity, NotificationType, UserRole } from '@prisma/client';
import { CronJob } from 'cron';
import { PrismaService } from '../common/prisma/prisma.service';
import { AppConfig } from '../config/app.config';
import { NotificationService } from './notification/notification.service';

/**
 * Daily cron: tìm (SP×CN) có onHand < minStock → tạo Notification cho MANAGER.
 * Dedupe: 1 notif per (productId × branchId) trong 24h gần nhất để tránh spam.
 */
@Injectable()
export class LowStockScheduler implements OnModuleInit {
  private readonly logger = new Logger(LowStockScheduler.name);

  constructor(
    private readonly cfg: AppConfig,
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
    private readonly registry: SchedulerRegistry,
  ) {}

  onModuleInit(): void {
    const job = CronJob.from({
      cronTime: this.cfg.inventory.lowStockCron,
      onTick: () => {
        this.run().catch((err) => this.logger.error(`low-stock scan failed: ${err.message}`));
      },
    });
    this.registry.addCronJob('inventory-low-stock', job);
    job.start();
    this.logger.log(`Low-stock scheduler armed: cron="${this.cfg.inventory.lowStockCron}"`);
  }

  /** Public để admin có thể trigger manual qua endpoint nếu cần. */
  async run(): Promise<{ found: number; notified: number }> {
    const rows = await this.prisma.productStock.findMany({
      where: {
        onHand: { gt: 0 }, // đã hết thì không cảnh báo "sắp hết" — dashboard có view riêng cho 'out-of-stock'
        product: { isTracked: true, minStock: { not: null } },
      },
      include: {
        product: { select: { id: true, code: true, name: true, minStock: true } },
        branch: { select: { id: true, name: true } },
      },
    });
    const lowStocks = rows.filter(
      (s) => s.product.minStock !== null && s.onHand < s.product.minStock,
    );
    if (!lowStocks.length) {
      this.logger.log('low-stock scan: 0 found');
      return { found: 0, notified: 0 };
    }

    // Dedupe 24h
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recent = await this.prisma.notification.findMany({
      where: { type: NotificationType.LOW_STOCK, createdAt: { gte: since } },
      select: { payload: true },
    });
    const recentKeys = new Set(
      recent
        .map((r) => r.payload as { productId?: number; branchId?: number } | null)
        .filter((p): p is { productId: number; branchId: number } => !!p?.productId)
        .map((p) => `${p.productId}:${p.branchId}`),
    );

    let notified = 0;
    for (const s of lowStocks) {
      const key = `${s.productId}:${s.branchId}`;
      if (recentKeys.has(key)) continue;
      await this.notifications.create({
        type: NotificationType.LOW_STOCK,
        severity: s.onHand === 0 ? NotificationSeverity.CRITICAL : NotificationSeverity.WARNING,
        title: `Tồn kho thấp: ${s.product.name} @ ${s.branch.name}`,
        body: `Còn ${s.onHand} / ngưỡng ${s.product.minStock}. Cân nhắc nhập hàng.`,
        payload: {
          productId: s.productId,
          productCode: s.product.code,
          branchId: s.branchId,
          branchName: s.branch.name,
          onHand: s.onHand,
          minStock: s.product.minStock,
        },
        targetRole: UserRole.MANAGER,
      });
      notified++;
    }
    this.logger.log(`low-stock scan: found=${lowStocks.length} notified=${notified}`);
    return { found: lowStocks.length, notified };
  }
}
