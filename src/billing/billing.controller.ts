import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { BillingService } from './billing.service';
import { MarkInvoicePaidDto } from './dto/mark-invoice-paid.dto';
import { UpdateInvoiceAdjustmentsDto } from './dto/update-invoice-adjustments.dto';

@ApiTags('Billing')
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('invoices')
  @ApiOperation({ summary: 'Get invoices (optional by customer)' })
  getInvoices(@Query('customerId') customerId?: string) {
    return this.billingService.getInvoices(customerId);
  }

  @Get('invoices/:id')
  @ApiOperation({ summary: 'Get invoice details' })
  getInvoice(@Param('id') id: string) {
    return this.billingService.getInvoiceById(id);
  }

  @Patch('invoices/:id/adjustments')
  @ApiOperation({ summary: 'Replace invoice adjustments (+/-) and recalculate totals' })
  updateAdjustments(
    @Param('id') id: string,
    @Body() dto: UpdateInvoiceAdjustmentsDto,
  ) {
    return this.billingService.updateInvoiceAdjustments(id, dto);
  }

  @Post('invoices/:id/pay')
  @ApiOperation({ summary: 'Mark invoice as paid and activate pending customer' })
  markPaid(@Param('id') id: string, @Body() dto: MarkInvoicePaidDto) {
    return this.billingService.markInvoicePaid(id, dto);
  }

  @Post('customers/:customerId/invoices/generate')
  @ApiOperation({
    summary: 'Generate a new invoice from customer subscription and remembered adjustments',
  })
  generateInvoice(@Param('customerId') customerId: string) {
    return this.billingService.generateInvoiceForCustomer(customerId);
  }
}
