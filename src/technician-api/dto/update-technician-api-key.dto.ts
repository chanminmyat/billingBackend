import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateTechnicianApiKeyDto {
  @ApiPropertyOptional({ example: 'MikroTik Auto Suspend' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: 'Used by technician service to cut/restore PPPoE users' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({
    example: '203.0.113.10, 198.51.100.25',
    description: 'Comma separated public IP addresses allowed to call this key. Leave blank to allow any IP.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  allowedIps?: string;
}
