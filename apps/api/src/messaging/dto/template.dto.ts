import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { MessageChannel } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

export class CreateTemplateDto {
  @ApiProperty({ example: 'ZNS_REACTIVATE_30D' })
  @IsString()
  @Length(3, 80)
  code!: string;

  @ApiProperty({ enum: MessageChannel })
  @IsEnum(MessageChannel)
  channel!: MessageChannel;

  @ApiProperty()
  @IsString()
  @Length(1, 200)
  name!: string;

  @ApiProperty({ description: 'Body với {{placeholder}}' })
  @IsString()
  @Length(1, 2000)
  body!: string;

  @ApiPropertyOptional({ description: 'Template id đã duyệt từ provider (Zalo ZNS…)' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  providerTemplateId?: string;

  @ApiPropertyOptional({
    description: 'JSON schema biến (ví dụ {"name":"string","lastVisit":"date"})',
  })
  @IsOptional()
  variables?: Record<string, unknown>;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateTemplateDto extends PartialType(CreateTemplateDto) {}

export class TemplateResponseDto {
  @ApiProperty() id!: number;
  @ApiProperty() code!: string;
  @ApiProperty({ enum: MessageChannel }) channel!: MessageChannel;
  @ApiProperty() name!: string;
  @ApiProperty() body!: string;
  @ApiPropertyOptional() providerTemplateId?: string | null;
  @ApiPropertyOptional() variables?: unknown;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() placeholders!: string[];
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}
