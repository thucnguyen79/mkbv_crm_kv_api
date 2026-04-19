import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { MessageChannel, MessageStatus, MessageTemplate, Prisma } from '@prisma/client';
import { Queue } from 'bullmq';
import { PrismaService } from '../common/prisma/prisma.service';
import { Paginated, paginate } from '../common/pagination/pagination.dto';
import { normalizePhone } from '../integration/sync/phone.util';
import { SendMessageDto } from './dto/send-message.dto';
import { MessageLogResponseDto, QueryMessageDto } from './dto/query-message.dto';
import { TemplateService } from './template/template.service';
import { bindTemplate } from './template/template.util';

export const MESSAGING_QUEUE_NAME = 'messaging';

/** Job data giữ tối thiểu — tất cả ngữ cảnh lưu ở MessageLog để restart an toàn. */
export interface MessagingJobData {
  logId: string; // BigInt dưới dạng string cho BullMQ JSON payload
  allowFallback: boolean;
  campaignExecId: number | null;
  fallbackTemplateCode: string | null;
}

export interface EnqueueInput {
  customerId?: number | null;
  phone: string;
  channel: MessageChannel;
  template: MessageTemplate;
  variables: Record<string, unknown>;
  allowFallback?: boolean;
  campaignExecId?: number | null;
  fallbackTemplateCode?: string | null;
}

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly templates: TemplateService,
    @InjectQueue(MESSAGING_QUEUE_NAME) private readonly queue: Queue<MessagingJobData>,
  ) {}

  /**
   * Enqueue 1 tin nhắn:
   * - Bind variables vào body (throw nếu thiếu biến)
   * - Tạo MessageLog QUEUED
   * - Push BullMQ job với attempts+backoff
   */
  async enqueue(input: EnqueueInput): Promise<bigint> {
    const body = bindTemplate(input.template.body, input.variables);
    const phone = normalizePhone(input.phone);
    if (!phone) throw new BadRequestException(`Invalid phone: ${input.phone}`);

    const log = await this.prisma.messageLog.create({
      data: {
        customerId: input.customerId ?? null,
        phone,
        channel: input.channel,
        templateCode: input.template.code,
        payload: {
          variables: input.variables as Prisma.InputJsonValue,
          body,
          providerTemplateId: input.template.providerTemplateId,
        } as Prisma.InputJsonValue,
        status: MessageStatus.QUEUED,
        campaignExecId: input.campaignExecId ?? null,
      },
    });

    await this.queue.add(
      'send',
      {
        logId: log.id.toString(),
        allowFallback: !!input.allowFallback,
        campaignExecId: input.campaignExecId ?? null,
        fallbackTemplateCode: input.fallbackTemplateCode ?? null,
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: 500,
        removeOnFail: 1_000,
      },
    );

    return log.id;
  }

  /**
   * API `/messages/send` — enqueue hàng loạt.
   * Trả về list logId đã tạo + skip list (customer không có phone, phone invalid…).
   */
  async sendBulk(dto: SendMessageDto): Promise<{ enqueued: string[]; skipped: string[] }> {
    const template = await this.templates.loadActiveByCode(dto.templateCode);
    const channel = dto.channel ?? template.channel;

    if (dto.channel && template.channel !== dto.channel) {
      // allow override nhưng cảnh báo để ops biết. Vẫn dùng dto.channel.
      this.logger.warn(
        `Channel override: template=${template.channel} → requested=${dto.channel} (code=${template.code})`,
      );
    }

    // Resolve target list: (phone, customerId?)
    type Target = { phone: string; customerId: number | null };
    const targets: Target[] = [];
    const skipped: string[] = [];

    if (dto.customerIds?.length) {
      const customers = await this.prisma.customer.findMany({
        where: { id: { in: dto.customerIds } },
        select: { id: true, phone: true },
      });
      const found = new Map(customers.map((c) => [c.id, c.phone]));
      for (const id of dto.customerIds) {
        const phone = found.get(id);
        if (!phone) {
          skipped.push(`customer:${id}:not-found-or-no-phone`);
          continue;
        }
        targets.push({ phone, customerId: id });
      }
    }
    if (dto.phones?.length) {
      for (const raw of dto.phones) {
        const phone = normalizePhone(raw);
        if (!phone) {
          skipped.push(`phone:${raw}:invalid`);
          continue;
        }
        targets.push({ phone, customerId: null });
      }
    }
    if (!targets.length) throw new BadRequestException('No valid targets to send');

    const enqueued: string[] = [];
    for (const t of targets) {
      try {
        const id = await this.enqueue({
          customerId: t.customerId,
          phone: t.phone,
          channel,
          template,
          variables: dto.variables ?? {},
          allowFallback: dto.allowFallback,
        });
        enqueued.push(id.toString());
      } catch (err) {
        skipped.push(`${t.phone}:${(err as Error).message}`);
      }
    }
    return { enqueued, skipped };
  }

  async list(query: QueryMessageDto): Promise<Paginated<MessageLogResponseDto>> {
    const where: Prisma.MessageLogWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.channel) where.channel = query.channel;
    if (query.customerId) where.customerId = query.customerId;
    if (query.phone) {
      const p = normalizePhone(query.phone);
      if (p) where.phone = p;
    }
    if (query.from || query.to) {
      where.queuedAt = {};
      if (query.from) (where.queuedAt as Prisma.DateTimeFilter).gte = new Date(query.from);
      if (query.to) (where.queuedAt as Prisma.DateTimeFilter).lte = new Date(query.to);
    }

    const [rows, total] = await Promise.all([
      this.prisma.messageLog.findMany({
        where,
        orderBy: { queuedAt: 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.messageLog.count({ where }),
    ]);
    return paginate(rows.map(toLogResponse), total, query);
  }

  async get(id: string): Promise<MessageLogResponseDto> {
    const row = await this.prisma.messageLog.findUnique({ where: { id: BigInt(id) } });
    if (!row) throw new NotFoundException(`Message ${id} not found`);
    return toLogResponse(row);
  }
}

function toLogResponse(r: {
  id: bigint;
  customerId: number | null;
  phone: string;
  channel: MessageChannel;
  templateCode: string | null;
  status: MessageStatus;
  providerId: string | null;
  providerName: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  attempts: number;
  queuedAt: Date;
  sentAt: Date | null;
}): MessageLogResponseDto {
  return {
    id: r.id.toString(),
    customerId: r.customerId,
    phone: r.phone,
    channel: r.channel,
    templateCode: r.templateCode,
    status: r.status,
    providerId: r.providerId,
    providerName: r.providerName,
    errorCode: r.errorCode,
    errorMessage: r.errorMessage,
    attempts: r.attempts,
    queuedAt: r.queuedAt,
    sentAt: r.sentAt,
  };
}
