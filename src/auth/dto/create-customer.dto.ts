import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { CustomerIntakeDto } from '../../customers/dto/customer-intake.dto';

export class CreateCustomerDto {
  @ApiProperty({ type: CustomerIntakeDto })
  @ValidateNested()
  @Type(() => CustomerIntakeDto)
  customer: CustomerIntakeDto;
}
