import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrderService } from './order.service';
import { QueryOrderDto } from './dto/order.dto';

@ApiTags('orders')
@ApiBearerAuth()
@Controller({ path: 'orders', version: '1' })
export class OrderController {
  constructor(private readonly service: OrderService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách đơn hàng (có filter customerId/branchId/sourceType/date)' })
  list(@Query() query: QueryOrderDto) {
    return this.service.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết đơn hàng' })
  get(@Param('id', ParseIntPipe) id: number) {
    return this.service.get(id);
  }
}

@ApiTags('customers')
@ApiBearerAuth()
@Controller({ path: 'customers', version: '1' })
export class CustomerOrdersController {
  constructor(private readonly orders: OrderService) {}

  @Get(':id/orders')
  @ApiOperation({ summary: 'Đơn hàng của 1 khách hàng' })
  list(@Param('id', ParseIntPipe) id: number, @Query() query: QueryOrderDto) {
    return this.orders.listForCustomer(id, query);
  }
}
