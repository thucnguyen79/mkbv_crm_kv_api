import { BadRequestException, Injectable } from '@nestjs/common';
import { AutomationRule } from './rule.interface';
import { InactiveCustomerRule } from './inactive-customer.rule';
import { BirthdayRule } from './birthday.rule';
import { TierUpgradeRule } from './tier-upgrade.rule';
import { CustomSegmentRule } from './custom-segment.rule';

/**
 * Đăng ký tất cả rule. Mỗi rule tự inject dep (PrismaService…) qua NestJS DI.
 * AutomationService tra rule bằng code (Campaign.ruleCode).
 */
@Injectable()
export class RuleRegistry {
  private readonly byCode: Map<string, AutomationRule>;

  constructor(
    inactive: InactiveCustomerRule,
    birthday: BirthdayRule,
    tierUpgrade: TierUpgradeRule,
    segment: CustomSegmentRule,
  ) {
    const list: AutomationRule[] = [inactive, birthday, tierUpgrade, segment];
    this.byCode = new Map(list.map((r) => [r.code, r]));
  }

  list(): AutomationRule[] {
    return [...this.byCode.values()];
  }

  get(code: string): AutomationRule {
    const r = this.byCode.get(code);
    if (!r) throw new BadRequestException(`Unknown automation rule: ${code}`);
    return r;
  }
}
