import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'technician_api_keys' })
export class TechnicianApiKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 120 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ length: 24 })
  keyPrefix: string;

  @Column({ unique: true })
  keyHash: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'simple-array', nullable: true })
  allowedIps?: string[] | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastUsedAt?: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
