import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AdjustmentType, AdjustmentValueType } from './bill-adjustment.entity';

@Entity({ name: 'global_invoice_adjustments' })
export class GlobalInvoiceAdjustment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

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
