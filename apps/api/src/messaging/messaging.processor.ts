import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { MessageChannel, MessageStatus, Prisma } from '@prisma/client';
import { Job } from 'bullmq';
import { PrismaService } from '../common/prisma/prisma.service';
import { TemplateService } from './template/template.service';
import { bindTemplate } from './template/template.util';
import { MESSAGING_QUEUE_NAME, MessagingJobData, MessagingService } from './messaging.service';
import { ProviderFactory } from './providers/provider.factory';
import { ProviderFallbackError } from './providers/message-provider.interface';

/**
 * Worker gửi message:
 *  1. Đọc MessageLog (logId từ job) → SENDING
 *  2. Gọi provider → SENT (OK) hoặc xử lý lỗi
 *  3. Nếu lỗi `ProviderFallbackError` + allowFallback + có template fallback phù hợp:
 *     - Mark log FALLBACK
 *     - Enqueue tin SMS mới (MessageLog mới) — không throw để không retry ZNS
 *  4. Lỗi khác → throw cho BullMQ retry theo config (attempts: 3, backoff exp).
 *     Khi hết attempts, BullMQ gọi `onFailed` → đánh FAILED.
 */
@Processor(MESSAGING_QUEUE_NAME, { concurrency: 5 })
export class MessagingProcessor extends WorkerHost {
  private readonly logger = new Logger(MessagingProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: ProviderFactory,
    private readonly templates: TemplateService,
    private readonly messaging: MessagingService,
  ) {
    super();
  }

  async process(job: Job<MessagingJobData>): Promise<void> {
    const logId = BigInt(job.data.logId);
    const log = await this.prisma.messageLog.update({
      where: { id: logId },
      data: { status: MessageStatus.SENDING, attempts: { increment: 1 } },
    });

    const provider = this.providers.get(log.channel);
    const payload = (log.payload ?? {}) as {
      body?: string;
      variables?: Record<string, unknown>;
      providerTemplateId?: string | null;
    };
    const body = payload.body ?? '';

    try {
      const result = await provider.send({
        phone: log.phone,
        body,
        templateCode: log.templateCode,
        providerTemplateId: payload.providerTemplateId ?? null,
        variables: payload.variables ?? {},
      });
      await this.prisma.messageLog.update({
        where: { id: logId },
        data: {
          status: MessageStatus.SENT,
          sentAt: new Date(),
          providerId: result.providerId,
          providerName: result.providerName,
        },
      });
      this.logger.log(
        `✓ sent id=${logId} channel=${log.channel} phone=${log.phone} attempt=${job.attemptsMade + 1}`,
      );
    } catch (err) {
      await this.handleError(job, logId, log.channel, err as Error);
    }
  }

  private async handleError(
    job: Job<MessagingJobData>,
    logId: bigint,
    channel: MessageChannel,
    err: Error,
  ): Promise<void> {
    const isFallbackable = err instanceof ProviderFallbackError;
    const canFallback =
      isFallbackable &&
      job.data.allowFallback &&
      channel === MessageChannel.ZNS &&
      !!job.data.fallbackTemplateCode;

    if (canFallback) {
      await this.prisma.messageLog.update({
        where: { id: logId },
        data: {
          status: MessageStatus.FALLBACK,
          errorCode: (err as ProviderFallbackError).code,
          errorMessage: err.message,
        },
      });
      await this.enqueueFallback(logId, job.data.fallbackTemplateCode!, job.data.campaignExecId);
      this.logger.warn(
        `↘ fallback ZNS→SMS: logId=${logId} reason=${(err as ProviderFallbackError).code}`,
      );
      return; // không throw → không retry ZNS
    }

    // Lỗi thường → để BullMQ retry. Khi out-of-attempts, onFailed sẽ đánh FAILED.
    const attempts = job.opts.attempts ?? 1;
    const willRetry = job.attemptsMade + 1 < attempts;
    await this.prisma.messageLog.update({
      where: { id: logId },
      data: {
        status: willRetry ? MessageStatus.RETRYING : MessageStatus.FAILED,
        errorCode: isFallbackable ? (err as ProviderFallbackError).code : 'PROVIDER_ERROR',
        errorMessage: err.message.slice(0, 500),
      },
    });
    this.logger.warn(
      `✗ send failed id=${logId} attempt=${job.attemptsMade + 1}/${attempts} err=${err.message}`,
    );
    throw err;
  }

  private async enqueueFallback(
    originalLogId: bigint,
    fallbackTemplateCode: string,
    campaignExecId: number | null,
  ): Promise<void> {
    const original = await this.prisma.messageLog.findUnique({ where: { id: originalLogId } });
    if (!original) return;
    const template = await this.templates.loadActiveByCode(fallbackTemplateCode);
    const payload = (original.payload ?? {}) as {
      variables?: Record<string, unknown>;
    };
    // Re-bind vào body của template fallback (SMS thường có body khác ZNS)
    const variables = payload.variables ?? {};
    // Validate bind sớm — nếu fail, throw ra để caller thấy lỗi
    bindTemplate(template.body, variables);

    await this.messaging.enqueue({
      customerId: original.customerId,
      phone: original.phone,
      channel: template.channel,
      template,
      variables,
      campaignExecId,
      allowFallback: false, // tránh fallback-of-fallback
    });
  }

  /** Nhận diện job đã hết attempts → đánh FAILED (processor đã đánh RETRYING). */
  async onFailed(job: Job<MessagingJobData>, err: Error): Promise<void> {
    const attempts = job.opts.attempts ?? 1;
    if (job.attemptsMade >= attempts) {
      await this.prisma.messageLog.update({
        where: { id: BigInt(job.data.logId) },
        data: {
          status: MessageStatus.FAILED,
          errorMessage: err.message.slice(0, 500),
        } as Prisma.MessageLogUpdateInput,
      });
    }
  }
}
