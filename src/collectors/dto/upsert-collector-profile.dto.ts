import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpsertCollectorProfileDto {
  @ApiPropertyOptional({ example: 'COL-001', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  collectorCode?: string;

  @ApiPropertyOptional({
    example: 'No. 123, Merchant Street, Yangon',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @ApiPropertyOptional({ example: 'Latha', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  township?: string;

  @ApiPropertyOptional({ example: 'Yangon', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  region?: string;

  @ApiPropertyOptional({ example: 'Downtown Route', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  route?: string;

  @ApiPropertyOptional({ example: 'Covers south district', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  notes?: string;
}
