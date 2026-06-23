import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateTechnicianApiKeyStatusDto {
  @ApiProperty({ example: false })
  @IsBoolean()
  isActive: boolean;
}
