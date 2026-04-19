import { Module } from '@nestjs/common';
import { KiotVietModule } from './kiotviet/kiotviet.module';
import { SyncModule } from './sync/sync.module';
import { WebhookModule } from './webhook/webhook.module';

@Module({
  imports: [KiotVietModule, SyncModule, WebhookModule],
  exports: [KiotVietModule, SyncModule],
})
export class IntegrationModule {}
