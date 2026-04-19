import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { RawBodyRequest } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { Public } from '../../auth/decorators/public.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { WebhookService } from './webhook.service';
import { KvWebhookPayload } from '../kiotviet/dto/kiotviet.dto';

@ApiTags('webhooks')
@Controller({ path: 'webhooks', version: '1' })
export class WebhookController {
  constructor(private readonly webhooks: WebhookService) {}

  @Public()
  @Post('kiotviet')
  @HttpCode(200)
  @ApiOperation({
    summary: 'KiotViet webhook endpoint',
    description:
      'Verifies HMAC signature from X-Hub-Signature, enqueues incremental sync for affected entities, returns within 5s.',
  })
  async handle(
    @Headers('x-hub-signature') signature: string | undefined,
    @Req() req: RawBodyRequest<Request>,
    @Body() payload: KvWebhookPayload,
  ) {
    if (!req.rawBody) {
      throw new Error('Raw body missing — ensure NestFactory.create({ rawBody: true })');
    }
    const verified = this.webhooks.verifySignature(req.rawBody, signature);
    return this.webhooks.handle(payload, req.rawBody.length, verified);
  }

  @Get('kiotviet/recent')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '100 webhook gần nhất từ KiotViet (ring buffer Redis, TTL 24h)',
  })
  recent(@Query('limit') limit?: string) {
    return this.webhooks.recentLogs(limit ? Number(limit) : 50);
  }
}
