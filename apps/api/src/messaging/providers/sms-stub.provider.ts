import { Injectable, Logger } from '@nestjs/common';
import { MessageChannel } from '@prisma/client';
import { MessageProvider, SendMessageInput, SendMessageResult } from './message-provider.interface';

/** Log-only SMS provider. Thay bằng ESMS / Stringee / VNPT-SMS khi triển khai thật. */
@Injectable()
export class SmsStubProvider implements MessageProvider {
  readonly name = 'sms-stub';
  readonly channel = MessageChannel.SMS;
  private readonly logger = new Logger(SmsStubProvider.name);

  async send(input: SendMessageInput): Promise<SendMessageResult> {
    this.logger.log(`[SMS stub] → ${input.phone} | body="${truncate(input.body)}"`);
    return {
      providerId: `stub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      providerName: this.name,
    };
  }
}

function truncate(s: string, max = 160): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}
