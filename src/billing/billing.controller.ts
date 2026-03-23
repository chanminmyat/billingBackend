import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { BillingService } from './billing.service';
import {
  AssignBillingRuleCustomersDto,
  AssignBillingRuleInvoicesDto,
} from './dto/assign-billing-rule.dto';
import { CreateBillingRuleDto } from './dto/create-billing-rule.dto';
import { GenerateInvoiceDto } from './dto/generate-invoice.dto';
import { MarkInvoicePaidDto } from './dto/mark-invoice-paid.dto';
import { UpdateBillingRuleDto } from './dto/update-billing-rule.dto';
import { UpdateInvoiceCollectionDto } from './dto/update-invoice-collection.dto';
import { UpdateGlobalInvoiceAdjustmentsDto } from './dto/update-global-invoice-adjustments.dto';
import { UpdateInvoiceAdjustmentsDto } from './dto/update-invoice-adjustments.dto';

@ApiTags('Billing')
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('rules')
  @ApiOperation({ summary: 'Get all billing rules' })
  getBillingRules() {
    return this.billingService.getBillingRules();
  }

  @Post('rules')
  @ApiOperation({ summary: 'Create a billing rule' })
  createBillingRule(@Body() dto: CreateBillingRuleDto) {
    return this.billingService.createBillingRule(dto);
  }

  @Patch('rules/:id')
  @ApiOperation({ summary: 'Update a billing rule' })
  updateBillingRule(@Param('id') id: string, @Body() dto: UpdateBillingRuleDto) {
    return this.billingService.updateBillingRule(id, dto);
  }

  @Post('rules/assign-customers')
  @ApiOperation({ summary: 'Assign billing rule to customers' })
  assignRuleToCustomers(@Body() dto: AssignBillingRuleCustomersDto) {
    return this.billingService.assignRuleToCustomers(undefined, dto);
  }

  @Post('rules/:id/assign-customers')
  @ApiOperation({ summary: 'Assign billing rule to customers by rule id' })
  assignRuleToCustomersById(
    @Param('id') id: string,
    @Body() dto: AssignBillingRuleCustomersDto,
  ) {
    return this.billingService.assignRuleToCustomers(id, dto);
  }

  @Post('rules/assign-invoices')
  @ApiOperation({ summary: 'Assign billing rule to invoices' })
  assignRuleToInvoices(@Body() dto: AssignBillingRuleInvoicesDto) {
    return this.billingService.assignRuleToInvoices(undefined, dto);
  }

  @Post('rules/:id/assign-invoices')
  @ApiOperation({ summary: 'Assign billing rule to invoices by rule id' })
  assignRuleToInvoicesById(
    @Param('id') id: string,
    @Body() dto: AssignBillingRuleInvoicesDto,
  ) {
    return this.billingService.assignRuleToInvoices(id, dto);
  }

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

  @Get('global-adjustments')
  @ApiOperation({ summary: 'Get global invoice adjustments' })
  getGlobalAdjustments(@Query('activeOnly') activeOnly?: string) {
    const onlyActive = ['1', 'true', 'yes'].includes((activeOnly ?? '').toLowerCase());
    return this.billingService.getGlobalAdjustments(onlyActive);
  }

  @Put('global-adjustments')
  @ApiOperation({ summary: 'Replace global invoice adjustments' })
  updateGlobalAdjustments(@Body() dto: UpdateGlobalInvoiceAdjustmentsDto) {
    return this.billingService.updateGlobalAdjustments(dto);
  }

  @Patch('invoices/:id/adjustments')
  @ApiOperation({ summary: 'Replace invoice adjustments (+/-) and recalculate totals' })
  updateAdjustments(
    @Param('id') id: string,
    @Body() dto: UpdateInvoiceAdjustmentsDto,
  ) {
    return this.billingService.updateInvoiceAdjustments(id, dto);
  }

  @Post('invoices/:id/cancel')
  @ApiOperation({ summary: 'Cancel an unpaid invoice' })
  cancelInvoice(@Param('id') id: string) {
    return this.billingService.cancelInvoice(id);
  }

  @Post('invoices/:id/pay')
  @ApiOperation({ summary: 'Mark invoice as paid and activate pending customer' })
  markPaid(@Param('id') id: string, @Body() dto: MarkInvoicePaidDto) {
    return this.billingService.markInvoicePaid(id, dto);
  }

  @Post('invoices/:id/collection-workflow')
  @ApiOperation({ summary: 'Update invoice collection workflow status and append timeline event' })
  updateCollectionWorkflow(
    @Param('id') id: string,
    @Body() dto: UpdateInvoiceCollectionDto,
  ) {
    return this.billingService.updateInvoiceCollectionWorkflow(id, dto);
  }

  @Post('customers/:customerId/invoices/generate')
  @ApiOperation({
    summary: 'Generate a new invoice from customer subscription and remembered adjustments',
  })
  generateInvoice(
    @Param('customerId') customerId: string,
    @Body() dto: GenerateInvoiceDto,
  ) {
    return this.billingService.generateInvoiceForCustomer(customerId, dto);
  }
}
