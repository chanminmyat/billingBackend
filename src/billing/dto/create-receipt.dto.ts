import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateReceiptDto {
  @ApiPropertyOptional({ example: 'Cash' })
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiPropertyOptional({ example: 'RC-03260001' })
  @IsOptional()
  @IsString()
  receiptNo?: string;

  @ApiPropertyOptional({ example: '2026-04-18T10:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  paidAt?: string;
}
