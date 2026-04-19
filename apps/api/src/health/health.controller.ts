import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('health')
@Public()
@Controller({ path: 'health', version: '1' })
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /** Liveness — chỉ cần process còn sống. K8s / Docker dùng cái này để restart container. */
  @Get()
  health() {
    return { status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() };
  }

  /** Readiness — DB + Redis. Nếu degraded, LB nên tạm lấy instance này ra khỏi pool. */
  @Get('ready')
  async ready() {
    const checks: Record<string, string> = {};
    let ok = true;

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = 'ok';
    } catch (err) {
      checks.database = (err as Error).message.slice(0, 200);
      ok = false;
    }

    try {
      const pong = await this.redis.client.ping();
      checks.redis = pong === 'PONG' ? 'ok' : `unexpected: ${pong}`;
      if (pong !== 'PONG') ok = false;
    } catch (err) {
      checks.redis = (err as Error).message.slice(0, 200);
      ok = false;
    }

    return { status: ok ? 'ok' : 'degraded', checks };
  }
}
