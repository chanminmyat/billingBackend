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
import { Bill } from './bill.entity';

export enum AdjustmentType {
  PLUS = 'plus',
  MINUS = 'minus',
}

export enum AdjustmentValueType {
  FIXED = 'fixed',
  PERCENT = 'percent',
}

@Entity({ name: 'bill_adjustments' })
export class BillAdjustment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Bill, (bill) => bill.adjustments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'bill_id' })
  bill: Bill;

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

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  amount: string;

  @Column({ default: false })
  rememberForNext: boolean;

  @Column({ default: 0 })
  sortOrder: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
