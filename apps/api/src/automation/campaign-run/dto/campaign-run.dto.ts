import { ApiPropertyOptional } from '@nestjs/swagger';
import { CampaignRunStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Length } from 'class-validator';
import { PaginationQueryDto } from '../../../common/pagination/pagination.dto';

export class QueryCampaignRunDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: CampaignRunStatus })
  @IsOptional()
  @IsEnum(CampaignRunStatus)
  status?: CampaignRunStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  campaignId?: number;
}

export class RejectRunDto {
  @IsString()
  @Length(1, 500)
  reason!: string;
}
