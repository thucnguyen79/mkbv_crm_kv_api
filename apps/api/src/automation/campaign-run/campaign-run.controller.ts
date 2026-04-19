import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AutomationService } from '../automation.service';
import { CampaignRunService } from './campaign-run.service';
import { QueryCampaignRunDto, RejectRunDto } from './dto/campaign-run.dto';

@ApiTags('campaign-runs')
@ApiBearerAuth()
@Controller({ path: 'campaign-runs', version: '1' })
export class CampaignRunController {
  constructor(
    private readonly runs: CampaignRunService,
    private readonly automation: AutomationService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List campaign runs (filter theo status / campaign)' })
  list(@Query() query: QueryCampaignRunDto) {
    return this.runs.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Xem chi tiết run (bao gồm snapshot match)' })
  get(@Param('id', ParseIntPipe) id: number) {
    return this.runs.get(id);
  }

  @Post(':id/approve')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(200)
  @ApiOperation({ summary: 'Duyệt run → enqueue message (admin/manager)' })
  async approve(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    const userId = requireUserId(req);
    await this.automation.approve(id, userId);
    return { ok: true };
  }

  @Post(':id/reject')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(200)
  @ApiOperation({ summary: 'Từ chối run với lý do (admin/manager)' })
  async reject(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RejectRunDto,
    @Req() req: Request,
  ) {
    const userId = requireUserId(req);
    await this.automation.reject(id, userId, dto.reason);
    return { ok: true };
  }

  @Post(':id/cancel')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @HttpCode(200)
  @ApiOperation({ summary: 'Huỷ run (chỉ creator hoặc admin)' })
  async cancel(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    const userId = requireUserId(req);
    await this.automation.cancel(id, userId);
    return { ok: true };
  }
}

function requireUserId(req: Request): number {
  const id = (req.user as { id?: number } | undefined)?.id;
  if (!id) throw new ForbiddenException('Missing authenticated user');
  return id;
}
