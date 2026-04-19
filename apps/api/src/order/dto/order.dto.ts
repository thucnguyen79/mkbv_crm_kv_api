import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderSource } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination/pagination.dto';

export class QueryOrderDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  customerId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  branchId?: number;

  @ApiPropertyOptional({ enum: OrderSource })
  @IsOptional()
  @IsEnum(OrderSource)
  sourceType?: OrderSource;

  @ApiPropertyOptional({ example: '2025-01-01' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2025-12-31' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;
}

export class OrderItemResponseDto {
  @ApiProperty() id!: number;
  @ApiPropertyOptional() productId?: number | null;
  @ApiProperty() name!: string;
  @ApiProperty() quantity!: number;
  @ApiProperty() price!: number;
  @ApiProperty() discount!: number;
}

export class OrderResponseDto {
  @ApiProperty() id!: number;
  @ApiProperty() externalCode!: string;
  @ApiProperty({ enum: OrderSource }) sourceType!: OrderSource;
  @ApiPropertyOptional() customerId?: number | null;
  @ApiPropertyOptional() customerName?: string | null;
  @ApiPropertyOptional() branchId?: number | null;
  @ApiProperty() totalAmount!: number;
  @ApiProperty() discount!: number;
  @ApiProperty() status!: string;
  @ApiProperty() purchasedAt!: Date;
  @ApiProperty({ type: [OrderItemResponseDto] }) items!: OrderItemResponseDto[];
}
