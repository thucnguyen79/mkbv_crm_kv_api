import { MessageChannel } from '@prisma/client';

export interface SendMessageInput {
  phone: string;
  providerTemplateId?: string | null;
  templateCode?: string | null;
  body: string; // đã bind variables
  variables?: Record<string, unknown>;
  zaloUserId?: string | null; // cần cho ZALO_OA / ZNS khi provider hỗ trợ
}

export interface SendMessageResult {
  /** Provider-side message id (để tracing / báo cáo trạng thái sau này). */
  providerId: string;
  /** Tên provider thực tế dùng (ví dụ 'zns-stub', 'esms-sms'…). */
  providerName: string;
}

/**
 * Thrown bởi provider khi lỗi có thể fallback sang kênh khác
 * (ví dụ ZNS fail → thử SMS). Error thường (network, 5xx) thì throw Error
 * để BullMQ retry cùng provider.
 */
export class ProviderFallbackError extends Error {
  readonly retryableAsFallback = true;
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'ProviderFallbackError';
    this.code = code;
  }
}

export interface MessageProvider {
  readonly name: string;
  readonly channel: MessageChannel;
  send(input: SendMessageInput): Promise<SendMessageResult>;
}
