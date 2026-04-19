import { ApiPropertyOptional } from '@nestjs/swagger';
import { MessageChannel, MessageStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination/pagination.dto';

export class QueryMessageDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: MessageStatus })
  @IsOptional()
  @IsEnum(MessageStatus)
  status?: MessageStatus;

  @ApiPropertyOptional({ enum: MessageChannel })
  @IsOptional()
  @IsEnum(MessageChannel)
  channel?: MessageChannel;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  customerId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;
}

export class MessageLogResponseDto {
  id!: string; // BigInt serialized as string
  customerId!: number | null;
  phone!: string;
  channel!: MessageChannel;
  templateCode!: string | null;
  status!: MessageStatus;
  providerId!: string | null;
  providerName!: string | null;
  errorCode!: string | null;
  errorMessage!: string | null;
  attempts!: number;
  queuedAt!: Date;
  sentAt!: Date | null;
}
