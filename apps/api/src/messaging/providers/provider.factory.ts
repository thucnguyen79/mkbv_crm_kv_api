import { Injectable } from '@nestjs/common';
import { MessageChannel } from '@prisma/client';
import { MessageProvider } from './message-provider.interface';
import { ZnsStubProvider } from './zns-stub.provider';
import { SmsStubProvider } from './sms-stub.provider';
import { ZaloOaStubProvider } from './zalo-oa-stub.provider';

/**
 * Trả provider tương ứng với channel. Hiện tại chỉ có stub cho mỗi channel.
 * Khi có adapter thật, đăng ký thêm provider rồi sửa map này (hoặc đọc
 * env `ZNS_PROVIDER`/`SMS_PROVIDER` để chọn).
 */
@Injectable()
export class ProviderFactory {
  private readonly map: Map<MessageChannel, MessageProvider>;

  constructor(zns: ZnsStubProvider, sms: SmsStubProvider, zaloOa: ZaloOaStubProvider) {
    this.map = new Map<MessageChannel, MessageProvider>([
      [MessageChannel.ZNS, zns],
      [MessageChannel.SMS, sms],
      [MessageChannel.ZALO_OA, zaloOa],
    ]);
  }

  get(channel: MessageChannel): MessageProvider {
    const p = this.map.get(channel);
    if (!p) throw new Error(`No provider registered for channel ${channel}`);
    return p;
  }
}
