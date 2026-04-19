import { Injectable, NotImplementedException } from '@nestjs/common';
import { MessageChannel } from '@prisma/client';
import { MessageProvider, SendMessageInput, SendMessageResult } from './message-provider.interface';

/**
 * Placeholder cho Zalo OA (tin chăm sóc OA, 48h session rule).
 * Chưa implement — giữ slot để sau này thêm không phải đổi schema / interface.
 *
 * Khi implement cần:
 *  - Lưu last_interaction_at per (customer × OA) để check 48h trước khi gửi
 *  - Require zaloUserId (không gửi qua phone)
 *  - Endpoint: https://openapi.zalo.me/v3.0/oa/message/cs
 */
@Injectable()
export class ZaloOaStubProvider implements MessageProvider {
  readonly name = 'zalo-oa-stub';
  readonly channel = MessageChannel.ZALO_OA;

  async send(_input: SendMessageInput): Promise<SendMessageResult> {
    throw new NotImplementedException(
      'ZALO_OA provider chưa được implement. Đăng ký Zalo OA API + triển khai adapter để dùng.',
    );
  }
}
