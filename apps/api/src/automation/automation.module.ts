import { Module } from '@nestjs/common';
import { MessagingModule } from '../messaging/messaging.module';
import { AutomationController } from './automation.controller';
import { AutomationService } from './automation.service';
import { AutomationScheduler } from './automation.scheduler';
import { CampaignService } from './campaign/campaign.service';
import { CampaignController } from './campaign/campaign.controller';
import { CampaignRunService } from './campaign-run/campaign-run.service';
import { CampaignRunController } from './campaign-run/campaign-run.controller';
import { RuleRegistry } from './rules/rule.registry';
import { InactiveCustomerRule } from './rules/inactive-customer.rule';
import { BirthdayRule } from './rules/birthday.rule';
import { TierUpgradeRule } from './rules/tier-upgrade.rule';
import { CustomSegmentRule } from './rules/custom-segment.rule';

@Module({
  imports: [MessagingModule],
  providers: [
    InactiveCustomerRule,
    BirthdayRule,
    TierUpgradeRule,
    CustomSegmentRule,
    RuleRegistry,
    AutomationService,
    AutomationScheduler,
    CampaignService,
    CampaignRunService,
  ],
  controllers: [AutomationController, CampaignController, CampaignRunController],
  exports: [AutomationService],
})
export class AutomationModule {}
