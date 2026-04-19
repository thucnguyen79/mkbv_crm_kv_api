import {
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NotificationType, UserRole } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import type { Request } from 'express';
import { PaginationQueryDto } from '../../common/pagination/pagination.dto';
import { NotificationService } from './notification.service';

class QueryNotificationDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  unreadOnly?: boolean;
}

@ApiTags('notifications')
@ApiBearerAuth()
@Controller({ path: 'notifications', version: '1' })
export class NotificationController {
  constructor(private readonly service: NotificationService) {}

  @Get()
  @ApiOperation({ summary: 'Inbox notification của user hiện tại' })
  list(@Query() query: QueryNotificationDto, @Req() req: Request) {
    const u = userOf(req);
    return this.service.list(query, u.id, u.role);
  }

  @Post(':id/read')
  @HttpCode(200)
  async markRead(@Param('id') id: string, @Req() req: Request) {
    await this.service.markRead(id, userOf(req).id);
    return { ok: true };
  }

  @Post('read-all')
  @HttpCode(200)
  async markAllRead(@Req() req: Request) {
    const u = userOf(req);
    const count = await this.service.markAllRead(u.id, u.role);
    return { marked: count };
  }
}

function userOf(req: Request): { id: number; role: UserRole } {
  const u = req.user as { id?: number; role?: UserRole } | undefined;
  if (!u?.id || !u?.role) throw new ForbiddenException('Missing authenticated user');
  return { id: u.id, role: u.role };
}
