import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CustomerStatus } from '../../common/enums/customer-status.enum';
import { CustomerType } from '../../common/enums/customer-type.enum';
import { User } from '../../users/entities/user.entity';
import { Subscription } from '../../subscriptions/entities/subscription.entity';
import { Bill } from '../../billing/entities/bill.entity';

@Entity({ name: 'customers' })
export class Customer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  customerCode: string;

  @Column({ type: 'enum', enum: CustomerType })
  customerType: CustomerType;

  @Column({ type: 'enum', enum: CustomerStatus, default: CustomerStatus.ENABLE })
  status: CustomerStatus;

  @Column()
  primaryPhone: string;

  @Column({ nullable: true })
  secondaryPhone?: string | null;

  @Column({ nullable: true })
  contactEmail?: string | null;

  @Column({ nullable: true })
  installationAddress?: string | null;

  @Column({ nullable: true })
  billingAddress?: string | null;

  @Column({ nullable: true })
  installationMapLink?: string | null;

  @Column({ nullable: true })
  billingMapLink?: string | null;

  @Column({ nullable: true })
  collectorCode?: string | null;

  @Column({ nullable: true })
  billingRuleId?: string | null;

  @Column({ nullable: true })
  billingRuleName?: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  defaultInstallationFee: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  defaultAdditionalFees: string;

  @Column({ type: 'boolean', default: true })
  collectionServiceEnabled: boolean;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  collectionFee: string;

  @Column({ nullable: true })
  personalName?: string | null;

  @Column({ nullable: true })
  personalNrc?: string | null;

  @Column({ nullable: true })
  companyName?: string | null;

  @Column({ nullable: true })
  businessRegistrationNumber?: string | null;

  @Column({ nullable: true })
  taxIdentificationNumber?: string | null;

  @Column({ nullable: true })
  authorizedContactPerson?: string | null;

  @Column({ nullable: true })
  contactNrc?: string | null;

  @OneToOne(() => User, (user) => user.customer)
  user?: User;

  @OneToMany(() => Subscription, (subscription) => subscription.customer)
  subscriptions?: Subscription[];

  @OneToMany(() => Bill, (bill) => bill.customer)
  bills?: Bill[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
