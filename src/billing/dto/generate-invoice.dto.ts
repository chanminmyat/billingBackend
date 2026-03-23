import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { BillingCycle } from '../../common/enums/billing-cycle.enum';

export class GenerateInvoiceDto {
  @ApiPropertyOptional({ example: 'rule_001' })
  @IsOptional()
  @IsString()
  billingRuleId?: string;

  @ApiPropertyOptional({ example: 'Standard Quarterly Rule' })
  @IsOptional()
  @IsString()
  billingRuleName?: string;

  @ApiPropertyOptional({
    enum: BillingCycle,
    description: 'Directly set invoice billing cycle',
  })
  @IsOptional()
  @IsEnum(BillingCycle)
  billingCycle?: BillingCycle;

  @ApiPropertyOptional({
    example: 'quarterly',
    description: 'monthly | quarterly | yearly | custom | bi-yearly',
  })
  @IsOptional()
  @IsString()
  billingMode?: string;

  @ApiPropertyOptional({ example: 'fixed', description: 'fixed | anniversary' })
  @IsOptional()
  @IsString()
  firstInvoiceMode?: string;

  @ApiPropertyOptional({ example: 3, minimum: 1, maximum: 36 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(36)
  customMonths?: number;

  @ApiPropertyOptional({ example: 7, minimum: 0, maximum: 365 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(365)
  dueAfterDays?: number;

  @ApiPropertyOptional({ example: 1, minimum: 1, maximum: 31 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(31)
  fixedStartDay?: number;

  @ApiPropertyOptional({ example: 15, minimum: 1, maximum: 31 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(31)
  fixedDueDay?: number;
}
