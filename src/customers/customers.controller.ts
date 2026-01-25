import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { UpdateCustomerDetailsDto } from './dto/update-customer-details.dto';

@ApiTags('Customers')
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @ApiOperation({ summary: 'Get all customers' })
  getAll() {
    return this.customersService.getAllCustomers();
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update customer details' })
  updateCustomer(
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDetailsDto,
  ) {
    return this.customersService.updateCustomer(id, dto);
  }
}
