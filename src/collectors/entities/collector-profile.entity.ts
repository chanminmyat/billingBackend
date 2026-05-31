import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity({ name: 'collector_profiles' })
export class CollectorProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, nullable: true })
  collectorCode?: string | null;

  @Column({ length: 200, nullable: true })
  address?: string | null;

  @Column({ length: 120, nullable: true })
  township?: string | null;

  @Column({ length: 120, nullable: true })
  area?: string | null;

  @Column('simple-array', { nullable: true })
  assignedAreas?: string[] | null;

  @Column({ length: 120, nullable: true })
  region?: string | null;

  @Column({ length: 120, nullable: true })
  route?: string | null;

  @Column({ length: 30, nullable: true })
  language?: string | null;

  @Column({ length: 200, nullable: true })
  notes?: string | null;

  @Column({ length: 50, nullable: true, unique: true })
  nrc?: string | null;

  @Column({ length: 50, nullable: true })
  status?: string | null;

  @OneToOne(() => User, (user) => user.collectorProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
