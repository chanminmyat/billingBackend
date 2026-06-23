import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTechnicianApiKeyDto {
  @ApiProperty({ example: 'MikroTik Auto Suspend' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

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
