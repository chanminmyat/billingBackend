import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { BillingCycle } from '../../common/enums/billing-cycle.enum';
import { Customer } from '../../customers/entities/customer.entity';
import { Subscription } from '../../subscriptions/entities/subscription.entity';
import { BillAdjustment } from './bill-adjustment.entity';

export type InvoiceCollectionStatus =
  | 'idle'
  | 'en_route'
  | 'arrived'
  | 'rescheduled'
  | 'office_transfer'
  | 'collected_pending_admin'
  | 'completed';

export type InvoiceCollectionEventType =
  | 'en_route'
  | 'arrived'
  | 'rescheduled'
  | 'office_transfer'
  | 'collector_collected'
  | 'admin_confirmed';

export type ReceiptStatus = 'none' | 'issued' | 'cancelled';

export type InvoiceCollectionEvent = {
  id: string;
  type: InvoiceCollectionEventType;
  label: string;
  note?: string;
  timestamp: string;
  actorName?: string;
  actorRole?: string;
};

@Entity({ name: 'bills' })
export class Bill {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Customer, (customer) => customer.bills, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @ManyToOne(() => Subscription, (subscription) => subscription.bills, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'subscription_id' })
  subscription?: Subscription | null;

  @Column({ unique: true, nullable: true })
  invoiceNo?: string | null;

  @Column({ default: 'auto' })
  invoiceType: string;

  @Column({ type: 'date', nullable: true })
  invoiceDate?: string | null;

  @Column({ type: 'date', nullable: true })
  billingPeriodFrom?: string | null;

  @Column({ type: 'date', nullable: true })
  billingPeriodTo?: string | null;

  @Column({ type: 'enum', enum: BillingCycle, default: BillingCycle.MONTHLY })
  billingCycle: BillingCycle;

  @Column({ type: 'int', nullable: true })
  customBillingMonths?: number | null;

  @Column()
  billingMonth: string;

  @Column({ default: 1 })
  billingDay: number;

  @Column({ default: 7 })
  dueAfterDays: number;

  @Column({ nullable: true })
  billingRuleId?: string | null;

  @Column({ nullable: true })
  billingRuleName?: string | null;

  @Column({ default: 'MMK' })
  currency: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  monthlyFee: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  installationFee: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  additionalFees: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  collectionFee: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  discountAmount: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  subtotalAmount: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  plusAmount: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  minusAmount: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  totalAmount: string;

  @Column({ default: 'unpaid' })
  status: string;

  @Column({ type: 'varchar', default: 'idle' })
  collectionStatus: InvoiceCollectionStatus;

  @Column({ type: 'timestamptz', nullable: true })
  collectionUpdatedAt?: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  collectionEvents?: InvoiceCollectionEvent[] | null;

  @Column({ nullable: true })
  paymentMethod?: string | null;

  @Column({ nullable: true })
  receiptNo?: string | null;

  @Column({ type: 'varchar', default: 'none' })
  receiptStatus: ReceiptStatus;

  @Column({ type: 'date', nullable: true })
  dueDate?: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  issuedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  paidAt?: Date | null;

  @OneToMany(() => BillAdjustment, (adjustment) => adjustment.bill)
  adjustments?: BillAdjustment[];
}
