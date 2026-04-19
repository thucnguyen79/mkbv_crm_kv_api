import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { LoyaltyTier } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

export class CreateCustomerDto {
  @ApiProperty({ example: 'Nguyễn Văn A' })
  @IsString()
  @Length(1, 200)
  name!: string;

  @ApiProperty({ example: '0912345678', description: 'Sẽ được normalize trước khi lưu' })
  @IsString()
  @Length(9, 15)
  phone!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  gender?: boolean;

  @ApiPropertyOptional({ example: '1990-05-20' })
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  branchId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class UpdateCustomerDto extends PartialType(CreateCustomerDto) {}

export class CustomerResponseDto {
  @ApiProperty() id!: number;
  @ApiProperty() name!: string;
  @ApiProperty() phone!: string;
  @ApiPropertyOptional() email?: string | null;
  @ApiPropertyOptional() gender?: boolean | null;
  @ApiPropertyOptional() birthDate?: Date | null;
  @ApiPropertyOptional() address?: string | null;
  @ApiPropertyOptional() branchId?: number | null;
  @ApiProperty() totalSpent!: number;
  @ApiPropertyOptional() lastPurchaseAt?: Date | null;
  @ApiPropertyOptional({ enum: LoyaltyTier }) tier?: LoyaltyTier | null;
  @ApiProperty() points!: number;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}
