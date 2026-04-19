import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { CampaignType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/pagination/pagination.dto';

export class CreateCampaignDto {
  @ApiProperty({ example: 'Mời khách 30 ngày chưa quay lại' })
  @IsString()
  @Length(1, 200)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({ enum: CampaignType })
  @IsEnum(CampaignType)
  type!: CampaignType;

  @ApiProperty({ example: 'INACTIVE', description: 'Code của automation rule' })
  @IsString()
  ruleCode!: string;

  @ApiProperty({
    description: 'JSON cấu hình segment/filter (phụ thuộc rule)',
    example: { inactiveDays: 30, cooldownDays: 14, limit: 500 },
  })
  @IsObject()
  conditions!: Record<string, unknown>;

  @ApiProperty({ description: 'Id template chính' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  templateId!: number;

  @ApiPropertyOptional({ description: 'Id template fallback (SMS khi ZNS fail)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  fallbackTemplateId?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  allowFallback?: boolean;

  @ApiPropertyOptional({
    description: 'Cron expression — bắt buộc với RECURRING, bỏ với ONE_OFF/TRIGGERED',
    example: '0 9 * * *',
  })
  @IsOptional()
  @IsString()
  schedule?: string;

  @ApiPropertyOptional({
    description:
      'ONE_OFF luôn là true, TRIGGERED luôn là false, RECURRING tuỳ (default true).',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean;

  @ApiPropertyOptional({
    description: 'Khi duyệt, chạy lại match để lấy list fresh thay vì dùng snapshot',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  refreshOnApprove?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCampaignDto extends PartialType(CreateCampaignDto) {}

export class QueryCampaignDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: CampaignType })
  @IsOptional()
  @IsEnum(CampaignType)
  type?: CampaignType;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;
}
