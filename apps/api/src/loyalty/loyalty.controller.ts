import { Controller, Get, HttpCode, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { LoyaltyService } from './loyalty.service';

@ApiTags('loyalty')
@ApiBearerAuth()
@Controller({ path: 'loyalty', version: '1' })
export class LoyaltyController {
  constructor(private readonly service: LoyaltyService) {}

  @Get(':customerId')
  @ApiOperation({ summary: 'Trạng thái tích điểm + 20 giao dịch gần nhất' })
  status(@Param('customerId', ParseIntPipe) customerId: number) {
    return this.service.getStatus(customerId);
  }

  @Post(':customerId/recalculate')
  @Roles(UserRole.ADMIN)
  @HttpCode(200)
  @ApiOperation({ summary: 'Tính lại điểm + tier từ totalSpent (admin)' })
  recalculate(@Param('customerId', ParseIntPipe) customerId: number) {
    return this.service.recalculate(customerId);
  }
}
