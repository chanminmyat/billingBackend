import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'system_settings' })
export class SystemSetting {
  @PrimaryColumn()
  key: string;

  @Column({ type: 'jsonb', default: {} })
  value: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
