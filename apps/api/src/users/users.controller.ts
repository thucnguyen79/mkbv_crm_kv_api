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
import { IsOptional, IsString } from 'class-validator';
import type { Request } from 'express';
import { Permissions } from '../auth/permissions/permissions.decorator';
import { PaginationQueryDto } from '../common/pagination/pagination.dto';
import { CreateUserDto, ResetPasswordDto, UpdateUserDto } from './dto/user.dto';
import { UsersService } from './users.service';

class QueryUserDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;
}

function actorId(req: Request): number {
  return (req.user as { id: number }).id;
}

@ApiTags('users')
@ApiBearerAuth()
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get()
  @Permissions('user.read')
  list(@Query() query: QueryUserDto) {
    return this.service.list(query);
  }

  @Get(':id')
  @Permissions('user.read')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.service.get(id);
  }

  @Post()
  @Permissions('user.write')
  @ApiOperation({ summary: 'Tạo user mới. Admin nhập password trực tiếp.' })
  create(@Body() dto: CreateUserDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Permissions('user.write')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserDto, @Req() req: Request) {
    return this.service.update(id, dto, actorId(req));
  }

  @Post(':id/reset-password')
  @Permissions('user.write')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Admin đổi password cho user. Gửi lại password cho user qua kênh an toàn.',
  })
  async resetPassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResetPasswordDto,
    @Req() req: Request,
  ) {
    await this.service.resetPassword(id, dto, actorId(req));
    return { ok: true };
  }

  @Post(':id/toggle-active')
  @Permissions('user.write')
  @HttpCode(200)
  toggleActive(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.service.toggleActive(id, actorId(req));
  }

  @Delete(':id')
  @Permissions('user.delete')
  @HttpCode(204)
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    await this.service.remove(id, actorId(req));
  }
}
