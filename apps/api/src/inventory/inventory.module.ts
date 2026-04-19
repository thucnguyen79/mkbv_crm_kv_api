import { Module } from '@nestjs/common';
import { ProductController } from './product/product.controller';
import { ProductService } from './product/product.service';
import { ProductImageController } from './product/image.controller';
import { ProductImageService } from './product/image.service';
import { StockController } from './stock/stock.controller';
import { StockService } from './stock/stock.service';
import { VariantGroupController } from './variant/variant.controller';
import { VariantGroupService } from './variant/variant.service';
import { AttributeController } from './attribute/attribute.controller';
import { AttributeService } from './attribute/attribute.service';
import { NotificationController } from './notification/notification.controller';
import { NotificationService } from './notification/notification.service';
import { VelocityService } from './velocity/velocity.service';
import { VelocityScheduler } from './velocity/velocity.scheduler';
import { LowStockScheduler } from './low-stock.scheduler';

@Module({
  controllers: [
    ProductController,
    ProductImageController,
    StockController,
    VariantGroupController,
    AttributeController,
    NotificationController,
  ],
  providers: [
    ProductService,
    ProductImageService,
    StockService,
    VariantGroupService,
    AttributeService,
    NotificationService,
    VelocityService,
    VelocityScheduler,
    LowStockScheduler,
  ],
  exports: [NotificationService],
})
export class InventoryModule {}
