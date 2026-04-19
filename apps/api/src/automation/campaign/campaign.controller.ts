import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AutomationService } from '../automation.service';
import { CampaignService } from './campaign.service';
import { CreateCampaignDto, QueryCampaignDto, UpdateCampaignDto } from './dto/campaign.dto';

@ApiTags('campaigns')
@ApiBearerAuth()
@Controller({ path: 'campaigns', version: '1' })
export class CampaignController {
  constructor(
    private readonly campaigns: CampaignService,
    private readonly automation: AutomationService,
  ) {}

  @Get()
  list(@Query() query: QueryCampaignDto) {
    return this.campaigns.list(query);
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.campaigns.get(id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Tạo campaign (admin)' })
  create(@Body() dto: CreateCampaignDto) {
    return this.campaigns.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCampaignDto) {
    return this.campaigns.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(204)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.campaigns.remove(id);
  }

  @Post(':id/run')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({
    summary: 'Trigger run — tạo CampaignRun (PENDING_APPROVAL hoặc EXECUTED tuỳ campaign)',
  })
  run(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    const userId = (req.user as { id?: number } | undefined)?.id ?? null;
    return this.automation.runCampaign(id, { triggeredById: userId });
  }

  @Post(':id/dry-run')
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.MANAGER)
  @ApiOperation({ summary: 'Preview match — không enqueue, không tạo run' })
  dryRun(@Param('id', ParseIntPipe) id: number) {
    return this.automation.dryRun(id);
  }
}
