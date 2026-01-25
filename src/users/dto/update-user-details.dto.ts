import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, ValidateNested } from 'class-validator';
import { UpsertCollectorProfileDto } from '../../collectors/dto/upsert-collector-profile.dto';
import { UpdateCustomerDetailsDto } from '../../customers/dto/update-customer-details.dto';
import { UpdateUserDto } from './update-user.dto';

export class UpdateUserDetailsDto {
  @ApiPropertyOptional({ type: UpdateUserDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateUserDto)
  account?: UpdateUserDto;

  @ApiPropertyOptional({ type: UpsertCollectorProfileDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpsertCollectorProfileDto)
  collectorProfile?: UpsertCollectorProfileDto;

  @ApiPropertyOptional({ type: UpdateCustomerDetailsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateCustomerDetailsDto)
  customer?: UpdateCustomerDetailsDto;
}
