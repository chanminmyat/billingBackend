import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsString, ValidateNested } from 'class-validator';
import { CreateCustomerDetailsDto } from './create-customer-details.dto';
import { ServicesDto } from './customer-intake.dto';

export class UpdateCustomerServicesDto extends PartialType(ServicesDto) {
  @ApiPropertyOptional({
    example: 'PLAN-BASIC-50',
    description: 'Alias of serviceId (plan code) for update compatibility.',
  })
  @IsOptional()
  @IsString()
  planCode?: string;
}

export class UpdateCustomerDetailsDto extends PartialType(CreateCustomerDetailsDto) {
  @ApiPropertyOptional({
    type: UpdateCustomerServicesDto,
    description:
      'Optional subscription update payload. Use serviceId/planCode, serviceType, dates, ipType, and staticIpAddress.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateCustomerServicesDto)
  services?: UpdateCustomerServicesDto;
}
