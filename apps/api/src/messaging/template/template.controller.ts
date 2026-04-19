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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CreateTemplateDto, UpdateTemplateDto } from '../dto/template.dto';
import { TemplateService } from './template.service';

@ApiTags('templates')
@ApiBearerAuth()
@Controller({ path: 'templates', version: '1' })
export class TemplateController {
  constructor(private readonly service: TemplateService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách template tin nhắn' })
  list() {
    return this.service.list();
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Tạo template mới (admin)' })
  create(@Body() dto: CreateTemplateDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Cập nhật template (admin)' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTemplateDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(204)
  @ApiOperation({ summary: 'Xoá template (admin)' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
