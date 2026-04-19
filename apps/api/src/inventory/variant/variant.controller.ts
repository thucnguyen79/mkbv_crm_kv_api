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
import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { VariantGroupService } from './variant.service';

class CreateVariantGroupBody {
  @IsString()
  @Length(1, 80)
  code!: string;

  @IsString()
  @Length(1, 200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}

class AttachProductsBody {
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  productIds!: number[];
}

@ApiTags('variant-groups')
@ApiBearerAuth()
@Controller({ path: 'variant-groups', version: '1' })
export class VariantGroupController {
  constructor(private readonly service: VariantGroupService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết group + list biến thể + tổng onHand' })
  get(@Param('id', ParseIntPipe) id: number) {
    return this.service.get(id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  create(@Body() body: CreateVariantGroupBody) {
    return this.service.create(body);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  update(@Param('id', ParseIntPipe) id: number, @Body() body: CreateVariantGroupBody) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(204)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }

  @Post(':id/products')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(200)
  @ApiOperation({ summary: 'Gán SP vào group' })
  async attach(@Param('id', ParseIntPipe) id: number, @Body() body: AttachProductsBody) {
    await this.service.addProducts(id, body.productIds);
    return { ok: true };
  }

  @Delete(':id/products')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(200)
  @ApiOperation({ summary: 'Gỡ SP khỏi group' })
  async detach(@Param('id', ParseIntPipe) id: number, @Body() body: AttachProductsBody) {
    await this.service.removeProducts(id, body.productIds);
    return { ok: true };
  }
}
