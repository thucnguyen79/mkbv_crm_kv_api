import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MessageChannel, UserRole } from '@prisma/client';
import { IsOptional, IsString, Length } from 'class-validator';
import type { Request } from 'express';
import axios, { AxiosError } from 'axios';
import * as crypto from 'node:crypto';
import { Roles } from '../auth/decorators/roles.decorator';
import { AppConfig } from '../config/app.config';
import { ProviderFactory } from '../messaging/providers/provider.factory';
import { normalizePhone } from '../integration/sync/phone.util';
import { SettingsService, SETTING_KEYS } from './settings.service';

class SetValueDto {
  @IsString()
  @Length(0, 4000)
  value!: string;
}

class TestMessageDto {
  @IsString()
  @Length(8, 20)
  phone!: string;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  body?: string;

  @IsOptional()
  @IsString()
  zaloUserId?: string;
}

@ApiTags('settings')
@ApiBearerAuth()
@Controller({ path: 'settings', version: '1' })
export class SettingsController {
  constructor(
    private readonly settings: SettingsService,
    private readonly providerFactory: ProviderFactory,
    private readonly cfg: AppConfig,
  ) {}

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List toàn bộ setting + secret đã mask' })
  list() {
    return this.settings.listAll();
  }

  @Post(':key')
  @Roles(UserRole.ADMIN)
  @HttpCode(200)
  @ApiOperation({ summary: 'Cập nhật 1 setting theo key' })
  async set(
    @Param('key') key: string,
    @Body() dto: SetValueDto,
    @Req() req: Request,
  ) {
    const knownKeys = Object.values(SETTING_KEYS);
    if (!knownKeys.includes(key as (typeof knownKeys)[number])) {
      return { ok: false, error: 'Unknown setting key' };
    }
    const userId = (req.user as { id?: number } | undefined)?.id;
    await this.settings.set(key, dto.value, userId);
    return { ok: true };
  }

  // ======= KiotViet tests =======

  @Post('kiotviet/test-api')
  @Roles(UserRole.ADMIN)
  @HttpCode(200)
  @ApiOperation({ summary: 'Test OAuth2 token + gọi /branches — xác minh retailer' })
  async testKiotVietApi() {
    const cfg = this.settings.getKiotVietConfig();
    if (!cfg.retailer || !cfg.clientId || !cfg.clientSecret) {
      return {
        ok: false,
        error: 'Thiếu retailer, clientId, hoặc clientSecret',
      };
    }
    try {
      const params = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        scope: cfg.scope,
      });
      const { data } = await axios.post<{ access_token: string; expires_in: number }>(
        cfg.tokenUrl,
        params.toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 10_000,
        },
      );
      const r = await axios.get(`${cfg.baseUrl}/branches`, {
        headers: {
          Retailer: cfg.retailer,
          Authorization: `Bearer ${data.access_token}`,
        },
        params: { pageSize: 1 },
        timeout: 10_000,
      });
      return {
        ok: true,
        tokenTtl: data.expires_in,
        retailerBranchCount: (r.data as { total?: number }).total ?? 0,
      };
    } catch (err) {
      return formatAxiosError(err);
    }
  }

  @Post('kiotviet/test-webhook')
  @Roles(UserRole.ADMIN)
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Self-ping webhook với HMAC sign → xác minh webhookSecret + endpoint phản hồi 200',
  })
  async testKiotVietWebhook() {
    const cfg = this.settings.getKiotVietConfig();
    if (!cfg.webhookSecret) {
      return { ok: false, error: 'Chưa cấu hình webhookSecret' };
    }
    // Dummy payload — notifications rỗng để không enqueue sync thật
    const payload = {
      Id: `test-${Date.now()}`,
      Attempt: 1,
      Notifications: [],
    };
    const rawBody = JSON.stringify(payload);
    const signature = crypto
      .createHmac('sha256', cfg.webhookSecret)
      .update(rawBody)
      .digest('hex');

    const url = `http://localhost:${this.cfg.apiPort}/api/v1/webhooks/kiotviet`;
    try {
      const { data, status } = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature': `sha256=${signature}`,
        },
        timeout: 10_000,
      });
      return {
        ok: true,
        httpStatus: status,
        response: data,
        hint: 'HMAC signature khớp và endpoint phản hồi 200. Kiểm tra /dashboard/webhooks để thấy entry vừa ghi.',
      };
    } catch (err) {
      const ax = err as AxiosError<{ message?: string }>;
      return {
        ok: false,
        httpStatus: ax.response?.status,
        error: ax.response?.data?.message || ax.message,
        hint:
          ax.response?.status === 401
            ? 'Signature không khớp → webhookSecret trong KV và CRM không giống nhau'
            : 'Webhook endpoint không phản hồi hoặc reject',
      };
    }
  }

  // ======= Messaging provider tests =======

  @Post('sms/test')
  @Roles(UserRole.ADMIN)
  @HttpCode(200)
  @ApiOperation({ summary: 'Gửi SMS test qua provider hiện tại' })
  async testSms(@Body() dto: TestMessageDto) {
    return this.sendProviderTest(MessageChannel.SMS, dto);
  }

  @Post('zns/test')
  @Roles(UserRole.ADMIN)
  @HttpCode(200)
  @ApiOperation({ summary: 'Gửi ZNS test (body rút gọn qua stub — provider thật cần template ID)' })
  async testZns(@Body() dto: TestMessageDto) {
    return this.sendProviderTest(MessageChannel.ZNS, dto);
  }

  @Post('zalo-oa/test')
  @Roles(UserRole.ADMIN)
  @HttpCode(200)
  @ApiOperation({ summary: 'Gửi test qua Zalo OA (provider stub báo NotImplemented)' })
  async testZaloOa(@Body() dto: TestMessageDto) {
    return this.sendProviderTest(MessageChannel.ZALO_OA, dto);
  }

  private async sendProviderTest(channel: MessageChannel, dto: TestMessageDto) {
    const phone = normalizePhone(dto.phone) ?? dto.phone;
    const body =
      dto.body ??
      `[TEST ${channel}] MKBV CRM ping lúc ${new Date().toLocaleString('vi-VN')}`;
    try {
      const provider = this.providerFactory.get(channel);
      const result = await provider.send({
        phone,
        body,
        zaloUserId: dto.zaloUserId ?? null,
      });
      return {
        ok: true,
        providerName: result.providerName,
        providerId: result.providerId,
        message: 'Đã gửi. Xem log API để xác minh (provider stub chỉ log).',
      };
    } catch (err) {
      return {
        ok: false,
        error: (err as Error).message,
      };
    }
  }
}

function formatAxiosError(err: unknown) {
  const ax = err as AxiosError<{ error_description?: string; message?: string }>;
  return {
    ok: false,
    status: ax.response?.status,
    error: ax.response?.data?.error_description || ax.response?.data?.message || ax.message,
  };
}
