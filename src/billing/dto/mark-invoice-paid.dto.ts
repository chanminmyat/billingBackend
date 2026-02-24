import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class MarkInvoicePaidDto {
  @ApiPropertyOptional({ example: 'KBZPay' })
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiPropertyOptional({ example: 'RCT-2026-0001' })
  @IsOptional()
  @IsString()
  receiptNo?: string;

  @ApiPropertyOptional({ example: '2026-02-10T08:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  paidAt?: string;
}
