import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
} from 'class-validator';

export class AssignBillingRuleCustomersDto {
  @ApiPropertyOptional({ example: 'rule-id' })
  @IsOptional()
  @IsString()
  ruleId?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  @Type(() => String)
  customerIds: string[];

  @ApiPropertyOptional({ example: '2026-03-22' })
  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  applyToUnreleasedInvoices?: boolean;
}

export class AssignBillingRuleInvoicesDto {
  @ApiPropertyOptional({ example: 'rule-id' })
  @IsOptional()
  @IsString()
  ruleId?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  @Type(() => String)
  invoiceIds: string[];

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  recalculate?: boolean;
}
