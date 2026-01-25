import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { BillingCycle } from '../../common/enums/billing-cycle.enum';
import { Customer } from '../../customers/entities/customer.entity';
import { Subscription } from '../../subscriptions/entities/subscription.entity';

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
  totalAmount: string;

  @Column({ default: 'unpaid' })
  status: string;

  @Column({ type: 'date', nullable: true })
  dueDate?: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  issuedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  paidAt?: Date | null;
}
