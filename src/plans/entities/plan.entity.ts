import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Subscription } from '../../subscriptions/entities/subscription.entity';

@Entity({ name: 'plans' })
export class Plan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  planCode: string;

  @Column()
  planName: string;

  @Column({ nullable: true })
  bandwidthPlan?: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  monthlyFee: string;

  @Column({ default: 'MMK' })
  currency: string;

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => Subscription, (subscription) => subscription.plan)
  subscriptions?: Subscription[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
