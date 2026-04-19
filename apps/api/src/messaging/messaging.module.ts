import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MessagingService, MESSAGING_QUEUE_NAME } from './messaging.service';
import { MessagingProcessor } from './messaging.processor';
import { MessagingController } from './messaging.controller';
import { TemplateService } from './template/template.service';
import { TemplateController } from './template/template.controller';
import { ProviderFactory } from './providers/provider.factory';
import { ZnsStubProvider } from './providers/zns-stub.provider';
import { SmsStubProvider } from './providers/sms-stub.provider';
import { ZaloOaStubProvider } from './providers/zalo-oa-stub.provider';

@Module({
  imports: [
    // BullModule.forRootAsync được config 1 lần ở AppModule — module này chỉ đăng ký queue.
    BullModule.registerQueue({ name: MESSAGING_QUEUE_NAME }),
  ],
  providers: [
    TemplateService,
    MessagingService,
    MessagingProcessor,
    ProviderFactory,
    ZnsStubProvider,
    SmsStubProvider,
    ZaloOaStubProvider,
  ],
  controllers: [TemplateController, MessagingController],
  exports: [MessagingService, TemplateService, ProviderFactory],
})
export class MessagingModule {}
