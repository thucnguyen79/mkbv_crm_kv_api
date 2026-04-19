import { Controller, Get, Header } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { collectDefaultMetrics, Gauge, register } from 'prom-client';
import { PrismaService } from '../common/prisma/prisma.service';
import { Public } from '../auth/decorators/public.decorator';

// Gọi 1 lần khi module load — sau đó `register` giữ state tự tăng.
collectDefaultMetrics({ prefix: 'mkbv_' });

const customerCount = new Gauge({
  name: 'mkbv_customer_total',
  help: 'Tổng số customer trong DB',
});
const orderCount = new Gauge({
  name: 'mkbv_order_total',
  help: 'Tổng số order trong DB',
});
const messageQueued = new Gauge({
  name: 'mkbv_message_queued',
  help: 'Số message đang ở trạng thái QUEUED',
});
const messageFailed = new Gauge({
  name: 'mkbv_message_failed_24h',
  help: 'Số message FAILED trong 24h gần nhất',
});
const syncFailedEntities = new Gauge({
  name: 'mkbv_sync_failed_entities',
  help: 'Số entity đang ở trạng thái sync=failed',
});
const lowStockCount = new Gauge({
  name: 'mkbv_low_stock_records',
  help: 'Số (SP × CN) đang onHand < minStock',
});

/**
 * Prometheus scrape endpoint. Public nhưng nên firewall ở reverse proxy
 * (Caddy `@internal` matcher chỉ cho mạng nội bộ).
 */
@ApiExcludeController()
@Public()
@Controller('metrics')
export class MetricsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Header('Content-Type', register.contentType)
  async scrape(): Promise<string> {
    // Cập nhật app-level gauge trước khi xuất metrics. Rẻ vì chỉ `count` query.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [cust, ord, qd, fl, sf, low] = await Promise.all([
      this.prisma.customer.count(),
      this.prisma.order.count(),
      this.prisma.messageLog.count({ where: { status: 'QUEUED' } }),
      this.prisma.messageLog.count({ where: { status: 'FAILED', queuedAt: { gte: since } } }),
      this.prisma.syncCursor.count({ where: { status: 'failed' } }),
      this.prisma.$queryRaw<Array<{ n: bigint }>>`
        SELECT COUNT(*)::bigint AS n
        FROM "ProductStock" ps
        JOIN "Product" p ON p.id = ps."productId"
        WHERE p."minStock" IS NOT NULL AND ps."onHand" < p."minStock"
      `,
    ]);
    customerCount.set(cust);
    orderCount.set(ord);
    messageQueued.set(qd);
    messageFailed.set(fl);
    syncFailedEntities.set(sf);
    lowStockCount.set(Number(low[0]?.n ?? 0));

    return register.metrics();
  }
}
