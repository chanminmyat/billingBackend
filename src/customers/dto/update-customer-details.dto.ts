import { PartialType } from '@nestjs/swagger';
import { CreateCustomerDetailsDto } from './create-customer-details.dto';

export class UpdateCustomerDetailsDto extends PartialType(CreateCustomerDetailsDto) {}
