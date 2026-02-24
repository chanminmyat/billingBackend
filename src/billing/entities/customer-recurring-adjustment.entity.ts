import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Customer } from '../../customers/entities/customer.entity';
import { AdjustmentType, AdjustmentValueType } from './bill-adjustment.entity';

@Entity({ name: 'customer_recurring_adjustments' })
export class CustomerRecurringAdjustment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Customer, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @Column()
  description: string;

  @Column({ type: 'enum', enum: AdjustmentType })
  type: AdjustmentType;

  @Column({ type: 'enum', enum: AdjustmentValueType, default: AdjustmentValueType.FIXED })
  valueType: AdjustmentValueType;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  value: string;

  @Column({ default: 0 })
  sortOrder: number;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
