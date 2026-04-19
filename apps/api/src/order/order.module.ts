import { Module } from '@nestjs/common';
import { CustomerOrdersController, OrderController } from './order.controller';
import { OrderService } from './order.service';

@Module({
  controllers: [OrderController, CustomerOrdersController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
