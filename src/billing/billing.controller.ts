import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { createReadStream } from 'fs';
import type { Request, Response } from 'express';
import { BillingService } from './billing.service';
import {
  AssignBillingRuleCustomersDto,
  AssignBillingRuleInvoicesDto,
} from './dto/assign-billing-rule.dto';
import { CreateBillingRuleDto } from './dto/create-billing-rule.dto';
import { CreatePaymentAccountDto } from './dto/create-payment-account.dto';
import { CreateReceiptDto } from './dto/create-receipt.dto';
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

  @Get('payment-accounts')
  @ApiOperation({ summary: 'Get payment accounts' })
  getPaymentAccounts(@Query('activeOnly') activeOnly?: string, @Req() request?: Request) {
    const onlyActive = ['1', 'true', 'yes'].includes((activeOnly ?? '').toLowerCase());
    const baseUrl = request ? `${request.protocol}://${request.get('host')}` : undefined;
    return this.billingService.getPaymentAccounts(onlyActive, baseUrl);
  }

  @Post('payment-accounts')
  @ApiOperation({ summary: 'Create payment account' })
  @UseInterceptors(FileInterceptor('qrCode'))
  createPaymentAccount(
    @Body() dto: CreatePaymentAccountDto,
    @UploadedFile() qrCodeFile?: { mimetype: string; buffer: Buffer },
  ) {
    return this.billingService.createPaymentAccount(dto, qrCodeFile);
  }

  @Get('payment-accounts/:id/qr')
  @ApiOperation({ summary: 'Get payment account QR image' })
  async getPaymentAccountQr(@Param('id') id: string, @Res({ passthrough: true }) res: Response) {
    const fileData = await this.billingService.getPaymentAccountQrFile(id);
    res.setHeader('Content-Type', fileData.contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return new StreamableFile(createReadStream(fileData.absolutePath));
  }

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

  @Get('receipts')
  @ApiOperation({ summary: 'Get generated receipt list' })
  getReceipts() {
    return this.billingService.getReceipts();
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

  @Post('invoices/:id/receipt')
  @ApiOperation({ summary: 'Generate receipt (if unpaid, confirm payment + generate receipt)' })
  generateReceipt(@Param('id') id: string, @Body() dto: CreateReceiptDto) {
    return this.billingService.generateReceiptForInvoice(id, dto);
  }

  @Post('invoices/:id/receipt/cancel')
  @ApiOperation({ summary: 'Cancel a generated receipt and mark the invoice cancelled' })
  cancelReceipt(@Param('id') id: string) {
    return this.billingService.cancelReceipt(id);
  }

  @Post('invoices/:id/collection-workflow')
  @ApiOperation({ summary: 'Update invoice collection workflow status and append timeline event' })
  @UseInterceptors(FileInterceptor('paymentSlip'))
  updateCollectionWorkflow(
    @Param('id') id: string,
    @Body() dto: UpdateInvoiceCollectionDto,
    @UploadedFile() paymentSlipFile?: { mimetype: string; buffer: Buffer },
    @Req() request?: Request,
  ) {
    const baseUrl = request ? `${request.protocol}://${request.get('host')}` : undefined;
    return this.billingService.updateInvoiceCollectionWorkflow(id, dto, paymentSlipFile, baseUrl);
  }

  @Get('invoices/:id/payment-slip')
  @ApiOperation({ summary: 'Get invoice payment slip image' })
  async getInvoicePaymentSlip(
    @Param('id') id: string,
    @Query('eventId') eventId: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const fileData = await this.billingService.getInvoicePaymentSlipFile(id, eventId);
    res.setHeader('Content-Type', fileData.contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return new StreamableFile(createReadStream(fileData.absolutePath));
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
