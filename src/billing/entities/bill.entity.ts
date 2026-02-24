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

  @Column()
  billingMonth: string;

  @Column({ default: 1 })
  billingDay: number;

  @Column({ default: 'MMK' })
  currency: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  monthlyFee: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  installationFee: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  additionalFees: string;

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

  @Column({ nullable: true })
  paymentMethod?: string | null;

  @Column({ nullable: true })
  receiptNo?: string | null;

  @Column({ type: 'date', nullable: true })
  dueDate?: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  issuedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  paidAt?: Date | null;

  @OneToMany(() => BillAdjustment, (adjustment) => adjustment.bill)
  adjustments?: BillAdjustment[];
}
