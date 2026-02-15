import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreatePlanDto {
  @ApiProperty({ example: 'PLAN-BASIC-50' })
  @IsString()
  planCode: string;

  @ApiProperty({ example: 'Basic Plan' })
  @IsString()
  planName: string;

  @ApiPropertyOptional({ example: '50/10 Mbps' })
  @IsOptional()
  @IsString()
  bandwidthPlan?: string;

  @ApiPropertyOptional({ example: 15000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  monthlyFee?: number;

  @ApiPropertyOptional({ example: 'MMK' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
