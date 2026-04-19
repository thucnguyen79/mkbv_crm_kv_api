import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MessageChannel } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  ValidateIf,
} from 'class-validator';

export class SendMessageDto {
  @ApiPropertyOptional({ type: [Number], description: 'Gửi cho customer có sẵn trong CRM' })
  @ValidateIf((o: SendMessageDto) => !o.phones || o.phones.length === 0)
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  customerIds?: number[];

  @ApiPropertyOptional({ type: [String], description: 'Gửi theo số điện thoại thô' })
  @ValidateIf((o: SendMessageDto) => !o.customerIds || o.customerIds.length === 0)
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsString({ each: true })
  phones?: string[];

  @ApiProperty({ example: 'ZNS_REACTIVATE_30D' })
  @IsString()
  @Length(3, 80)
  templateCode!: string;

  @ApiPropertyOptional({
    enum: MessageChannel,
    description: 'Override channel (mặc định lấy từ template)',
  })
  @IsOptional()
  @IsEnum(MessageChannel)
  channel?: MessageChannel;

  @ApiPropertyOptional({
    description:
      'Biến bind vào template. Nếu cần bind khác nhau mỗi người, truyền map {customerId|phone → vars} ở sau.',
  })
  @IsOptional()
  @IsObject()
  variables?: Record<string, unknown>;

  @ApiPropertyOptional({ default: false, description: 'Cho phép fallback ZNS → SMS nếu fail' })
  @IsOptional()
  @IsBoolean()
  allowFallback?: boolean;
}
