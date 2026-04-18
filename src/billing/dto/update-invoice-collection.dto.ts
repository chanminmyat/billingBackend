import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

const COLLECTION_STATUS_VALUES = [
  'idle',
  'en_route',
  'arrived',
  'rescheduled',
  'office_transfer',
  'collected_pending_admin',
  'completed',
] as const;

const COLLECTION_EVENT_TYPE_VALUES = [
  'en_route',
  'arrived',
  'rescheduled',
  'office_transfer',
  'collector_collected',
  'admin_confirmed',
] as const;

export class UpdateInvoiceCollectionDto {
  @ApiProperty({ enum: COLLECTION_STATUS_VALUES, example: 'en_route' })
  @IsString()
  @IsIn(COLLECTION_STATUS_VALUES)
  status: (typeof COLLECTION_STATUS_VALUES)[number];

  @ApiProperty({ enum: COLLECTION_EVENT_TYPE_VALUES, example: 'en_route' })
  @IsString()
  @IsIn(COLLECTION_EVENT_TYPE_VALUES)
  type: (typeof COLLECTION_EVENT_TYPE_VALUES)[number];

  @ApiProperty({ example: 'Collector is on the way to collect payment.' })
  @IsString()
  label: string;

  @ApiPropertyOptional({ example: 'Customer requested call before arrival.' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ example: 'Collector Chan' })
  @IsOptional()
  @IsString()
  actorName?: string;

  @ApiPropertyOptional({ example: 'collector' })
  @IsOptional()
  @IsString()
  actorRole?: string;

  @ApiPropertyOptional({ example: '2026-03-22T10:00:00.000Z' })
  @IsOptional()
  @IsString()
  timestamp?: string;

  @ApiPropertyOptional({ example: 'Cash' })
  @IsOptional()
  @IsString()
  paymentMethod?: string;
}
