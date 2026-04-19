import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { SendMessageDto } from './dto/send-message.dto';
import { QueryMessageDto } from './dto/query-message.dto';
import { MessagingService } from './messaging.service';

@ApiTags('messages')
@ApiBearerAuth()
@Controller({ path: 'messages', version: '1' })
export class MessagingController {
  constructor(private readonly service: MessagingService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách message log (filter theo status/channel/customer/date)' })
  list(@Query() query: QueryMessageDto) {
    return this.service.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết 1 message log' })
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Post('send')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Enqueue gửi tin nhắn (admin) — truyền customerIds hoặc phones',
  })
  send(@Body() dto: SendMessageDto) {
    return this.service.sendBulk(dto);
  }
}
