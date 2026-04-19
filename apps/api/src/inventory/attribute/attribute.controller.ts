import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AttributeKind, UserRole } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AttributeService } from './attribute.service';

class AttributeBody {
  @IsString()
  @Length(1, 80)
  code!: string;

  @IsString()
  @Length(1, 200)
  label!: string;

  @IsEnum(AttributeKind)
  kind!: AttributeKind;

  @IsOptional()
  options?: unknown;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@ApiTags('attribute-definitions')
@ApiBearerAuth()
@Controller({ path: 'attribute-definitions', version: '1' })
export class AttributeController {
  constructor(private readonly service: AttributeService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  create(@Body() body: AttributeBody) {
    return this.service.create(body);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  update(@Param('id', ParseIntPipe) id: number, @Body() body: AttributeBody) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(204)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
