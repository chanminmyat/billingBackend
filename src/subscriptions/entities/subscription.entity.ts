import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { IpType } from '../../common/enums/ip-type.enum';
import { Customer } from '../../customers/entities/customer.entity';
import { Plan } from '../../plans/entities/plan.entity';
import { SubscriptionNetwork } from '../../subscription-networks/entities/subscription-network.entity';
import { Bill } from '../../billing/entities/bill.entity';

@Entity({ name: 'subscriptions' })
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Customer, (customer) => customer.subscriptions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @ManyToOne(() => Plan, (plan) => plan.subscriptions, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'plan_id' })
  plan: Plan;

  @Column()
  serviceType: string;

  @Column({ type: 'date', nullable: true })
  serviceStartDate?: string | null;

  @Column({ type: 'date', nullable: true })
  contractStartDate?: string | null;

  @Column({ type: 'date', nullable: true })
  contractEndDate?: string | null;

  @Column({ type: 'date', nullable: true })
  installationDate?: string | null;

  @Column({ type: 'enum', enum: IpType, default: IpType.DYNAMIC })
  ipType: IpType;

  @Column({ nullable: true })
  staticIpAddress?: string | null;

  @OneToOne(() => SubscriptionNetwork, (network) => network.subscription)
  network?: SubscriptionNetwork;

  @OneToMany(() => Bill, (bill) => bill.subscription)
  bills?: Bill[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
