import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  AdjustmentType,
  AdjustmentValueType,
} from '../entities/bill-adjustment.entity';

export class InvoiceAdjustmentInputDto {
  @ApiProperty({ example: 'Router Fee' })
  @IsString()
  description: string;

  @ApiProperty({ enum: AdjustmentType, example: AdjustmentType.PLUS })
  @IsEnum(AdjustmentType)
  type: AdjustmentType;

  @ApiProperty({
    enum: AdjustmentValueType,
    example: AdjustmentValueType.FIXED,
  })
  @IsEnum(AdjustmentValueType)
  valueType: AdjustmentValueType;

  @ApiProperty({ example: 5000 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  value: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  rememberForNext?: boolean;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateInvoiceAdjustmentsDto {
  @ApiProperty({ type: [InvoiceAdjustmentInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceAdjustmentInputDto)
  adjustments: InvoiceAdjustmentInputDto[];
}
