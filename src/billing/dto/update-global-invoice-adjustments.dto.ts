import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { AdjustmentType, AdjustmentValueType } from '../entities/bill-adjustment.entity';

export class GlobalInvoiceAdjustmentInputDto {
  @ApiProperty({ example: 'Commercial tax' })
  @IsString()
  description: string;

  @ApiProperty({ enum: AdjustmentType, example: AdjustmentType.PLUS })
  @IsEnum(AdjustmentType)
  type: AdjustmentType;

  @ApiProperty({ enum: AdjustmentValueType, example: AdjustmentValueType.PERCENT })
  @IsEnum(AdjustmentValueType)
  valueType: AdjustmentValueType;

  @ApiProperty({ example: 5 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  value: number;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ example: 0, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sortOrder?: number;
}

export class UpdateGlobalInvoiceAdjustmentsDto {
  @ApiProperty({ type: [GlobalInvoiceAdjustmentInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GlobalInvoiceAdjustmentInputDto)
  adjustments: GlobalInvoiceAdjustmentInputDto[];
}
