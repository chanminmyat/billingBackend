import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CollectorProfile } from '../../collectors/entities/collector-profile.entity';
import { Customer } from '../../customers/entities/customer.entity';
import { PasswordResetToken } from '../../password-reset/entities/password-reset-token.entity';
import { UserRole } from '../../common/enums/user-role.enum';
import { UserStatus } from '../../common/enums/user-status.enum';

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 120 })
  name: string;

  @Column({ unique: true })
  email: string;

  @Column({ unique: true, nullable: true })
  phone?: string | null;

  @Column({ unique: true, nullable: true })
  username?: string | null;

  @Column({ select: false })
  passwordHash: string;

  @Column({ type: 'enum', enum: UserRole })
  role: UserRole;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.ACTIVE })
  status: UserStatus;


  @OneToOne(() => CollectorProfile, (profile) => profile.user)
  collectorProfile?: CollectorProfile;

  @OneToOne(() => Customer, (customer) => customer.user, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'customer_id' })
  customer?: Customer | null;

  @OneToMany(() => PasswordResetToken, (token) => token.user)
  passwordResetTokens?: PasswordResetToken[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
