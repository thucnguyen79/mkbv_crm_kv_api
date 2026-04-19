import { Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole, VelocityTag } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { PaginationQueryDto } from '../../common/pagination/pagination.dto';
import { VelocityService } from '../velocity/velocity.service';
import { LowStockScheduler } from '../low-stock.scheduler';
import { StockService } from './stock.service';

class QueryStockDto extends PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  branchId?: number;

  @IsOptional()
  @IsEnum(VelocityTag)
  velocityTag?: VelocityTag;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  belowMin?: boolean;

  @IsOptional()
  @IsString()
  search?: string;
}

class DeadStockQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  agingDaysGte?: number;
}

@ApiTags('stock')
@ApiBearerAuth()
@Controller({ path: 'stock', version: '1' })
export class StockController {
  constructor(
    private readonly service: StockService,
    private readonly velocity: VelocityService,
    private readonly lowStock: LowStockScheduler,
  ) {}

  @Get()
  async list(@Query() query: QueryStockDto) {
    const { rows, total } = await this.service.list({
      ...query,
      skip: query.skip,
      take: query.take,
    });
    return { data: rows, meta: { total, page: query.page, pageSize: query.pageSize } };
  }

  @Get('low')
  @ApiOperation({ summary: 'SP có onHand < minStock' })
  low(@Query('branchId') branchId?: number) {
    return this.service.lowStock(branchId ? Number(branchId) : undefined);
  }

  @Get('dead')
  @ApiOperation({ summary: 'SP tồn quá N ngày (mặc định INVENTORY_DEAD_AGING_DAYS)' })
  dead(@Query() q: DeadStockQuery) {
    return this.service.deadStock(q.agingDaysGte);
  }

  @Get('aging')
  @ApiOperation({ summary: 'Histogram aging: 0-30, 30-60, 60-90, 90-180, 180+' })
  aging(@Query('branchId') branchId?: number) {
    return this.service.agingHistogram(branchId ? Number(branchId) : undefined);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Tổng đơn vị + giá trị (cost & sell) + đếm belowMin/dead theo CN' })
  summary() {
    return this.service.summary();
  }

  @Get('transfer-suggestions')
  @ApiOperation({ summary: 'Gợi ý chuyển hàng giữa CN (dựa reorderPoint × surplus)' })
  transfers() {
    return this.service.transferSuggestions();
  }

  @Post('velocity/recompute')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Chạy tay velocity recompute (thường cron 2h sáng)' })
  recomputeVelocity() {
    return this.velocity.recomputeAll();
  }

  @Post('low-stock/scan')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Chạy tay low-stock scan → tạo notification' })
  scanLowStock() {
    return this.lowStock.run();
  }
}
