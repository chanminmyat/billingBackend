import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateBillingRuleDto {
  @ApiPropertyOptional({ example: 'Default Monthly Fixed' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'recurring' })
  @IsOptional()
  @IsIn(['recurring', 'usage'])
  billingModel?: 'recurring' | 'usage';

  @ApiPropertyOptional({ example: 'fixed' })
  @IsOptional()
  @IsIn(['fixed', 'anniversary'])
  billingType?: 'fixed' | 'anniversary';

  @ApiPropertyOptional({ example: 'monthly' })
  @IsOptional()
  @IsString()
  billingMode?: string;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(36)
  customMonths?: number | null;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  fixedBillingDay?: number | null;

  @ApiPropertyOptional({ example: 14 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(365)
  dueAfterDays?: number | null;

  @ApiPropertyOptional({ example: 'postpaid' })
  @IsOptional()
  @IsIn(['prepaid', 'postpaid'])
  prepaidPostpaid?: 'prepaid' | 'postpaid';

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  suspendOnOverdue?: boolean;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(365)
  graceDays?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  lateFeeEnabled?: boolean;

  @ApiPropertyOptional({ example: 'fixed' })
  @IsOptional()
  @IsIn(['fixed', 'percent'])
  lateFeeType?: 'fixed' | 'percent';

  @ApiPropertyOptional({ example: 'once' })
  @IsOptional()
  @IsIn(['once', 'per_day'])
  lateFeeApplyMode?: 'once' | 'per_day';

  @ApiPropertyOptional({ example: 500 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  lateFeeValue?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(365)
  lateFeeTriggerDays?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
