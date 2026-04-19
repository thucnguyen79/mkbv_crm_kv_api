import { Global, Module, forwardRef } from '@nestjs/common';
import { MessagingModule } from '../messaging/messaging.module';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

/**
 * Global: KiotVietAuthService / HttpService / WebhookService đều inject
 * SettingsService — tránh phải import đều ở mỗi module.
 *
 * forwardRef MessagingModule: SettingsController cần ProviderFactory để gửi
 * test message. MessagingModule không dep SettingsModule trực tiếp (nó dùng
 * SettingsService qua @Global) nên forwardRef là thừa nhưng defensive.
 */
@Global()
@Module({
  imports: [forwardRef(() => MessagingModule)],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
