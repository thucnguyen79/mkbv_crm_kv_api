import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Length,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty()
  @IsString()
  @Length(1, 200)
  fullName!: string;

  @ApiProperty({ description: 'Role ID (từ /roles)' })
  @Type(() => Number)
  @IsInt()
  roleId!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  branchId?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateUserDto extends PartialType(CreateUserDto) {}

export class ResetPasswordDto {
  @IsString()
  @MinLength(8)
  newPassword!: string;
}

export class UserResponseDto {
  id!: number;
  email!: string;
  fullName!: string;
  role!: string;
  roleId!: number | null;
  roleName!: string | null;
  branchId!: number | null;
  branchName!: string | null;
  isActive!: boolean;
  createdAt!: Date;
  updatedAt!: Date;
}
