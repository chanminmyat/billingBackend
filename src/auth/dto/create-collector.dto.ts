import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, ValidateNested } from 'class-validator';
import { UpsertCollectorProfileDto } from '../../collectors/dto/upsert-collector-profile.dto';
import { CreateAccountBaseDto } from '../../users/dto/create-account-base.dto';

export class CreateCollectorDto extends CreateAccountBaseDto {
  @ApiPropertyOptional({ type: UpsertCollectorProfileDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpsertCollectorProfileDto)
  profile?: UpsertCollectorProfileDto;
}
