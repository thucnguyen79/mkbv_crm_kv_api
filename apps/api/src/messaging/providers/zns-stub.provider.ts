import { Injectable, Logger } from '@nestjs/common';
import { MessageChannel } from '@prisma/client';
import { MessageProvider, SendMessageInput, SendMessageResult } from './message-provider.interface';

/**
 * Log-only ZNS provider. Thay bằng adapter thật (Zalo OA API, bên thứ ba
 * như ESMS/Stringee ZNS) khi có credentials — chỉ cần implement cùng interface.
 */
@Injectable()
export class ZnsStubProvider implements MessageProvider {
  readonly name = 'zns-stub';
  readonly channel = MessageChannel.ZNS;
  private readonly logger = new Logger(ZnsStubProvider.name);

  async send(input: SendMessageInput): Promise<SendMessageResult> {
    this.logger.log(
      `[ZNS stub] → ${input.phone} | template=${input.templateCode ?? 'raw'} | body="${truncate(input.body)}"`,
    );
    return {
      providerId: `stub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      providerName: this.name,
    };
  }
}

function truncate(s: string, max = 120): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}
