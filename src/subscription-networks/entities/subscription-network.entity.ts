import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Subscription } from '../../subscriptions/entities/subscription.entity';

@Entity({ name: 'subscription_networks' })
export class SubscriptionNetwork {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => Subscription, (subscription) => subscription.network, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'subscription_id' })
  subscription: Subscription;

  @Column({ nullable: true })
  routerId?: string | null;

  @Column({ nullable: true })
  macAddress?: string | null;

  @Column({ nullable: true })
  onuSerial?: string | null;

  @Column({ nullable: true })
  vlanPort?: string | null;

  @Column({ nullable: true })
  networkZone?: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
