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
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../auth/permissions/permissions.decorator';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  CreateRoleDto,
  SetRolePermissionsDto,
  UpdateRoleDto,
} from './dto/role.dto';
import { RolesService } from './roles.service';

@ApiTags('roles')
@ApiBearerAuth()
@Controller({ path: 'roles', version: '1' })
export class RolesController {
  constructor(
    private readonly service: RolesService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @Permissions('role.read')
  list() {
    return this.service.list();
  }

  @Get(':id')
  @Permissions('role.read')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.service.get(id);
  }

  @Post()
  @Permissions('role.write')
  @ApiOperation({ summary: 'Tạo custom role' })
  create(@Body() dto: CreateRoleDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Permissions('role.write')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRoleDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Permissions('role.delete')
  @HttpCode(204)
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.service.remove(id);
  }

  @Put(':id/permissions')
  @Permissions('role.write')
  @ApiOperation({ summary: 'Set toàn bộ permission cho role (replace)' })
  setPermissions(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetRolePermissionsDto,
  ) {
    return this.service.setPermissions(id, dto);
  }
}

@ApiTags('permissions')
@ApiBearerAuth()
@Controller({ path: 'permissions', version: '1' })
export class PermissionsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Permissions('role.read')
  @ApiOperation({ summary: 'Catalog permission (group by resource) cho UI role editor' })
  async list() {
    const rows = await this.prisma.permission.findMany({
      orderBy: [{ group: 'asc' }, { resource: 'asc' }, { action: 'asc' }],
    });
    return rows;
  }
}
