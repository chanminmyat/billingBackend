import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum PaymentAccountKind {
  WALLET = 'wallet',
  ACCOUNT = 'account',
}

@Entity({ name: 'payment_accounts' })
export class PaymentAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: PaymentAccountKind })
  kind: PaymentAccountKind;

  @Column({ nullable: true })
  walletType?: string | null;

  @Column({ nullable: true })
  bankType?: string | null;

  @Column()
  accountName: string;

  @Column()
  accountNumber: string;

  @Column({ type: 'text', nullable: true })
  qrCodeDataUrl?: string | null;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
