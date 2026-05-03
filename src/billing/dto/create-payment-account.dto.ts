import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { PaymentAccountKind } from '../entities/payment-account.entity';

export class CreatePaymentAccountDto {
  @ApiProperty({ enum: PaymentAccountKind, example: PaymentAccountKind.WALLET })
  @IsEnum(PaymentAccountKind)
  kind: PaymentAccountKind;

  @ApiPropertyOptional({ example: 'KBZPay' })
  @IsOptional()
  @IsString()
  walletType?: string;

  @ApiPropertyOptional({ example: 'KBZ' })
  @IsOptional()
  @IsString()
  bankType?: string;

  @ApiProperty({ example: 'Bill Pro Co.,Ltd' })
  @IsString()
  accountName: string;

  @ApiProperty({ example: '09123456789' })
  @IsString()
  accountNumber: string;

  @ApiPropertyOptional({ example: 'data:image/png;base64,...' })
  @IsOptional()
  @IsString()
  qrCodeDataUrl?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.toLowerCase() === 'true';
    return value;
  })
  @IsBoolean()
  isActive?: boolean;
}
