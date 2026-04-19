import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { KiotVietModule } from '../kiotviet/kiotviet.module';
import { CursorService } from './cursor.service';
import { SyncService, SYNC_QUEUE_NAME } from './sync.service';
import { SyncProcessor } from './sync.processor';
import { SyncScheduler } from './sync.scheduler';
import { SyncController } from './sync.controller';
import { BranchSyncStrategy } from './strategies/branch.sync';
import { UserSyncStrategy } from './strategies/user.sync';
import { CategorySyncStrategy } from './strategies/category.sync';
import { ProductSyncStrategy } from './strategies/product.sync';
import { CustomerSyncStrategy } from './strategies/customer.sync';
import { OrderSyncStrategy } from './strategies/order.sync';
import { InvoiceSyncStrategy } from './strategies/invoice.sync';

@Module({
  imports: [KiotVietModule, BullModule.registerQueue({ name: SYNC_QUEUE_NAME })],
  providers: [
    CursorService,
    BranchSyncStrategy,
    UserSyncStrategy,
    CategorySyncStrategy,
    ProductSyncStrategy,
    CustomerSyncStrategy,
    OrderSyncStrategy,
    InvoiceSyncStrategy,
    SyncService,
    SyncProcessor,
    SyncScheduler,
  ],
  controllers: [SyncController],
  exports: [SyncService, CursorService, BullModule],
})
export class SyncModule {}
