import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../auth/decorators/roles.decorator';
import { QueryProductDto, UpdateProductCrmDto } from './dto/product.dto';
import { ProductService } from './product.service';

@ApiTags('products')
@ApiBearerAuth()
@Controller({ path: 'products', version: '1' })
export class ProductController {
  constructor(private readonly service: ProductService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách SP (filter tag/attribute/branch/aging/velocity)' })
  list(@Query() query: QueryProductDto) {
    return this.service.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết SP + tồn kho tất cả CN + aging' })
  get(@Param('id', ParseIntPipe) id: number) {
    return this.service.get(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Cập nhật field phía CRM (tags, attributes, minStock, variant, isTracked)',
  })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProductCrmDto) {
    return this.service.updateCrm(id, dto);
  }
}
