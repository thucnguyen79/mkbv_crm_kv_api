import { Campaign } from '@prisma/client';

/** Một customer được rule chọn + biến để bind template. */
export interface CustomerMatch {
  customerId: number;
  phone: string;
  variables: Record<string, unknown>;
}

export interface RuleContext {
  campaign: Campaign;
  now: Date;
  /** Khi TRIGGERED: giới hạn chỉ xét customer nào, không quét toàn bộ DB. */
  customerIdHint?: number[];
}

export interface AutomationRule {
  /** Mã để Campaign.ruleCode trỏ vào. */
  readonly code: string;
  /** Mô tả ngắn để UI hiện. */
  readonly description: string;
  /** JSON schema (informal) mô tả `Campaign.conditions` rule này chấp nhận. */
  readonly conditionsSchema: Record<string, unknown>;

  match(ctx: RuleContext): Promise<CustomerMatch[]>;
}
