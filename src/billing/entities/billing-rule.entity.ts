import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type BillingRuleModel = 'recurring' | 'usage' | 'prepaid' | 'postpaid';
export type BillingRuleType = 'fixed' | 'anniversary';
export type BillingRuleMode = 'monthly' | 'quarterly' | 'bi_yearly' | 'yearly' | 'custom';
export type BillingRulePrepaidMode = 'prepaid' | 'postpaid';
export type BillingRuleLateFeeType = 'fixed' | 'percent';
export type BillingRuleLateFeeApplyMode = 'once' | 'per_day';

@Entity({ name: 'billing_rules' })
export class BillingRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ default: 'recurring' })
  billingModel: BillingRuleModel;

  @Column({ default: 'fixed' })
  billingType: BillingRuleType;

  @Column({ default: 'monthly' })
  billingMode: BillingRuleMode;

  @Column({ type: 'int', nullable: true })
  customMonths?: number | null;

  @Column({ type: 'int', nullable: true })
  fixedBillingDay?: number | null;

  @Column({ type: 'int', nullable: true })
  dueAfterDays?: number | null;

  @Column({ default: 'postpaid' })
  prepaidPostpaid: BillingRulePrepaidMode;

  @Column({ default: true })
  suspendOnOverdue: boolean;

  @Column({ type: 'int', default: 0 })
  graceDays: number;

  @Column({ default: false })
  lateFeeEnabled: boolean;

  @Column({ default: 'fixed' })
  lateFeeType: BillingRuleLateFeeType;

  @Column({ default: 'once' })
  lateFeeApplyMode: BillingRuleLateFeeApplyMode;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  lateFeeValue: string;

  @Column({ type: 'int', default: 0 })
  lateFeeTriggerDays: number;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'int', default: 1 })
  version: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
