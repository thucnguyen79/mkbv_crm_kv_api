import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({ description: 'slug unique, VD: cskh-level1' })
  @IsString()
  @Length(2, 50)
  code!: string;

  @ApiProperty()
  @IsString()
  @Length(1, 100)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdateRoleDto extends PartialType(CreateRoleDto) {}

export class SetRolePermissionsDto {
  @ApiProperty({ type: [String], description: 'List permission codes' })
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  codes!: string[];
}

export class RoleResponseDto {
  id!: number;
  code!: string;
  name!: string;
  description!: string | null;
  isSystem!: boolean;
  permissions!: string[];
  userCount!: number;
  createdAt!: Date;
  updatedAt!: Date;
}
