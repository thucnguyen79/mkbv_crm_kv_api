import { Injectable } from '@nestjs/common';
import {
  Notification,
  NotificationSeverity,
  NotificationType,
  Prisma,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  Paginated,
  paginate,
  PaginationQueryDto,
} from '../../common/pagination/pagination.dto';

export interface CreateNotificationInput {
  type: NotificationType;
  severity?: NotificationSeverity;
  title: string;
  body?: string;
  payload?: Record<string, unknown>;
  targetRole?: UserRole | null;
}

export interface NotificationResponse {
  id: string;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  body: string | null;
  payload: unknown;
  targetRole: UserRole | null;
  read: boolean;
  createdAt: Date;
}

@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateNotificationInput): Promise<Notification> {
    return this.prisma.notification.create({
      data: {
        type: input.type,
        severity: input.severity ?? NotificationSeverity.INFO,
        title: input.title.slice(0, 500),
        body: input.body?.slice(0, 2000) ?? null,
        payload: (input.payload ?? {}) as Prisma.InputJsonValue,
        targetRole: input.targetRole ?? null,
      },
    });
  }

  async list(
    query: PaginationQueryDto & { type?: NotificationType; unreadOnly?: boolean },
    userId: number,
    role: UserRole,
  ): Promise<Paginated<NotificationResponse>> {
    const where: Prisma.NotificationWhereInput = {
      OR: [{ targetRole: null }, { targetRole: role }],
    };
    if (query.type) where.type = query.type;

    const [rows, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.notification.count({ where }),
    ]);

    let mapped = rows.map((n) => toResponse(n, userId));
    if (query.unreadOnly) mapped = mapped.filter((n) => !n.read);
    return paginate(mapped, total, query);
  }

  async markRead(id: string, userId: number): Promise<void> {
    const n = await this.prisma.notification.findUnique({
      where: { id: BigInt(id) },
      select: { readBy: true },
    });
    if (!n) return;
    if (n.readBy.includes(userId)) return;
    await this.prisma.notification.update({
      where: { id: BigInt(id) },
      data: { readBy: { push: userId } },
    });
  }

  async markAllRead(userId: number, role: UserRole): Promise<number> {
    const rows = await this.prisma.notification.findMany({
      where: { OR: [{ targetRole: null }, { targetRole: role }] },
      select: { id: true, readBy: true },
    });
    let count = 0;
    for (const r of rows) {
      if (!r.readBy.includes(userId)) {
        await this.prisma.notification.update({
          where: { id: r.id },
          data: { readBy: { push: userId } },
        });
        count++;
      }
    }
    return count;
  }
}

function toResponse(n: Notification, userId: number): NotificationResponse {
  return {
    id: n.id.toString(),
    type: n.type,
    severity: n.severity,
    title: n.title,
    body: n.body,
    payload: n.payload,
    targetRole: n.targetRole,
    read: n.readBy.includes(userId),
    createdAt: n.createdAt,
  };
}
