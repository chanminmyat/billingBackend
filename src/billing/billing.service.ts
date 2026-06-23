import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, IsNull, Not, Repository } from 'typeorm';
import { UserStatus } from '../common/enums/user-status.enum';
import { CustomerStatus } from '../common/enums/customer-status.enum';
import { BillingCycle } from '../common/enums/billing-cycle.enum';
import { Customer } from '../customers/entities/customer.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { User } from '../users/entities/user.entity';
import { MarkInvoicePaidDto } from './dto/mark-invoice-paid.dto';
import { GenerateInvoiceDto } from './dto/generate-invoice.dto';
import { UpdateInvoiceCollectionDto } from './dto/update-invoice-collection.dto';
import {
  AssignBillingRuleCustomersDto,
  AssignBillingRuleInvoicesDto,
} from './dto/assign-billing-rule.dto';
import { CreateBillingRuleDto } from './dto/create-billing-rule.dto';
import { CreatePaymentAccountDto } from './dto/create-payment-account.dto';
import { CreateReceiptDto } from './dto/create-receipt.dto';
import { UpdateBillingRuleDto } from './dto/update-billing-rule.dto';
import {
  GlobalInvoiceAdjustmentInputDto,
  UpdateGlobalInvoiceAdjustmentsDto,
} from './dto/update-global-invoice-adjustments.dto';
import {
  InvoiceAdjustmentInputDto,
  UpdateInvoiceAdjustmentsDto,
} from './dto/update-invoice-adjustments.dto';
import {
  AdjustmentType,
  AdjustmentValueType,
  BillAdjustment,
} from './entities/bill-adjustment.entity';
import { Bill, InvoiceCollectionEvent } from './entities/bill.entity';
import { BillingRule } from './entities/billing-rule.entity';
import { CustomerRecurringAdjustment } from './entities/customer-recurring-adjustment.entity';
import { GlobalInvoiceAdjustment } from './entities/global-invoice-adjustment.entity';
import { PaymentAccount, PaymentAccountKind } from './entities/payment-account.entity';

type UploadedQrFile = {
  mimetype: string;
  buffer: Buffer;
};

@Injectable()
export class BillingService {
  constructor(
    @InjectRepository(Bill)
    private readonly billsRepository: Repository<Bill>,
    @InjectRepository(BillAdjustment)
    private readonly billAdjustmentsRepository: Repository<BillAdjustment>,
    @InjectRepository(BillingRule)
    private readonly billingRulesRepository: Repository<BillingRule>,
    @InjectRepository(CustomerRecurringAdjustment)
    private readonly recurringAdjustmentsRepository: Repository<CustomerRecurringAdjustment>,
    @InjectRepository(GlobalInvoiceAdjustment)
    private readonly globalAdjustmentsRepository: Repository<GlobalInvoiceAdjustment>,
    @InjectRepository(PaymentAccount)
    private readonly paymentAccountsRepository: Repository<PaymentAccount>,
    @InjectRepository(Customer)
    private readonly customersRepository: Repository<Customer>,
    @InjectRepository(Subscription)
    private readonly subscriptionsRepository: Repository<Subscription>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  private readonly paymentQrStorageDir = path.join(
    process.cwd(),
    'storage',
    'payment-account-qr',
  );

  private readonly paymentSlipStorageDir = path.join(
    process.cwd(),
    'storage',
    'payment-slips',
  );

  async getPaymentAccounts(activeOnly = false, baseUrl?: string) {
    const accounts = await this.paymentAccountsRepository.find({
      where: activeOnly ? { isActive: true } : undefined,
      order: {
        isActive: 'DESC',
        createdAt: 'DESC',
      },
    });
    return accounts.map((account) => {
      const qrCodeUrl = this.resolveQrCodeUrl(account, baseUrl);
      return {
        ...account,
        qrCodeDataUrl: qrCodeUrl,
      };
    });
  }

  async createPaymentAccount(dto: CreatePaymentAccountDto, qrCodeFile?: UploadedQrFile) {
    const kind = dto.kind;
    const accountName = dto.accountName?.trim();
    const accountNumber = dto.accountNumber?.trim();
    const walletType = dto.walletType?.trim();
    const bankType = dto.bankType?.trim();
    const qrCodeDataUrl = dto.qrCodeDataUrl?.trim();

    if (!accountName) {
      throw new BadRequestException('Account name is required');
    }

    if (!accountNumber) {
      throw new BadRequestException('Account number is required');
    }

    if (kind === PaymentAccountKind.WALLET) {
      if (!walletType) {
        throw new BadRequestException('Wallet type is required');
      }
      if (!qrCodeFile && !qrCodeDataUrl) {
        throw new BadRequestException('QR code is required for wallet');
      }
    }

    if (kind === PaymentAccountKind.ACCOUNT && !bankType) {
      throw new BadRequestException('Bank type is required');
    }

    let savedQrPath: string | null = null;
    if (kind === PaymentAccountKind.WALLET) {
      if (qrCodeFile) {
        savedQrPath = await this.persistUploadedQrCode(qrCodeFile);
      } else if (qrCodeDataUrl) {
        savedQrPath = await this.persistDataUrlQrCode(qrCodeDataUrl);
      }
    }

    const account = this.paymentAccountsRepository.create({
      kind,
      walletType: kind === PaymentAccountKind.WALLET ? walletType ?? null : null,
      bankType: kind === PaymentAccountKind.ACCOUNT ? bankType ?? null : null,
      accountName,
      accountNumber,
      qrCodeDataUrl: null,
      qrCodePath: savedQrPath,
      isActive: dto.isActive ?? true,
    });

    return this.paymentAccountsRepository.save(account);
  }

  async getPaymentAccountQrFile(accountId: string) {
    const account = await this.paymentAccountsRepository.findOne({
      where: { id: accountId },
    });
    if (!account) {
      throw new NotFoundException('Payment account not found');
    }

    const relativePath = account.qrCodePath?.trim();
    if (!relativePath) {
      throw new NotFoundException('QR code not found');
    }

    const resolvedPath = path.resolve(this.paymentQrStorageDir, relativePath);
    if (!resolvedPath.startsWith(path.resolve(this.paymentQrStorageDir))) {
      throw new BadRequestException('Invalid QR code path');
    }

    try {
      await fs.access(resolvedPath);
    } catch {
      throw new NotFoundException('QR code not found');
    }
    return {
      absolutePath: resolvedPath,
      fileName: path.basename(resolvedPath),
      contentType: this.detectImageContentType(resolvedPath),
    };
  }

  private resolveQrCodeUrl(account: PaymentAccount, baseUrl?: string) {
    const hasFileQr = Boolean(account.qrCodePath?.trim());
    if (hasFileQr) {
      const raw = process.env.APP_PUBLIC_BASE_URL?.trim() || baseUrl?.trim() || '';
      const normalizedBase = raw ? raw.replace(/\/$/, '') : '';
      if (!normalizedBase) return null;
      return `${normalizedBase}/billing/payment-accounts/${account.id}/qr`;
    }

    return account.qrCodeDataUrl ?? null;
  }

  private async ensureQrStorageDir() {
    await fs.mkdir(this.paymentQrStorageDir, { recursive: true });
  }

  private async persistUploadedQrCode(file: UploadedQrFile) {
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('QR code must be an image file');
    }
    await this.ensureQrStorageDir();
    const extFromMime = file.mimetype.split('/')[1] || 'png';
    const ext = extFromMime.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'png';
    const fileName = `${randomUUID()}.${ext}`;
    const targetPath = path.join(this.paymentQrStorageDir, fileName);
    await fs.writeFile(targetPath, file.buffer);
    return fileName;
  }

  private async persistDataUrlQrCode(dataUrl: string) {
    const matched = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!matched) {
      throw new BadRequestException('Invalid QR code format');
    }
    const mime = matched[1];
    const base64Data = matched[2];
    const buffer = Buffer.from(base64Data, 'base64');
    if (buffer.length === 0) {
      throw new BadRequestException('Invalid QR code image');
    }
    await this.ensureQrStorageDir();
    const ext = (mime.split('/')[1] || 'png').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'png';
    const fileName = `${randomUUID()}.${ext}`;
    const targetPath = path.join(this.paymentQrStorageDir, fileName);
    await fs.writeFile(targetPath, buffer);
    return fileName;
  }

  private detectImageContentType(filePath: string) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.png') return 'image/png';
    if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
    if (ext === '.gif') return 'image/gif';
    if (ext === '.webp') return 'image/webp';
    if (ext === '.svg') return 'image/svg+xml';
    return 'application/octet-stream';
  }

  private normalizeBillingModel(
    billingModel?: string | null,
    prepaidPostpaid?: string | null,
  ): 'recurring' | 'usage' | 'prepaid' | 'postpaid' {
    const normalizedModel = String(billingModel ?? '').trim().toLowerCase();
    if (normalizedModel === 'usage') return 'usage';
    if (normalizedModel === 'prepaid') return 'prepaid';
    if (normalizedModel === 'postpaid') return 'postpaid';
    if (normalizedModel === 'recurring') return 'recurring';

    const normalizedPaymentMode = String(prepaidPostpaid ?? '').trim().toLowerCase();
    if (normalizedPaymentMode === 'prepaid') return 'prepaid';
    if (normalizedPaymentMode === 'postpaid') return 'postpaid';
    return 'recurring';
  }

  private normalizePrepaidPostpaid(value?: string | null) {
    const normalized = String(value ?? '').trim().toLowerCase();
    return normalized === 'prepaid' ? 'prepaid' : 'postpaid';
  }

  private mapBillingRuleForOutput<
    T extends { billingModel?: string | null; prepaidPostpaid?: string | null }
  >(rule: T): T & {
    billingModel: 'recurring' | 'usage' | 'prepaid' | 'postpaid';
    prepaidPostpaid: 'prepaid' | 'postpaid';
  } {
    const normalizedModel = this.normalizeBillingModel(rule.billingModel, rule.prepaidPostpaid);
    const normalizedPaymentMode =
      normalizedModel === 'prepaid' ? 'prepaid' : this.normalizePrepaidPostpaid(rule.prepaidPostpaid);
    return {
      ...rule,
      billingModel: normalizedModel,
      prepaidPostpaid: normalizedPaymentMode,
    };
  }

  async getBillingRules() {
    const rules = await this.billingRulesRepository.find({
      order: {
        isActive: 'DESC',
        updatedAt: 'DESC',
        createdAt: 'DESC',
      },
    });
    return rules.map((rule) => this.mapBillingRuleForOutput(rule));
  }

  async createBillingRule(dto: CreateBillingRuleDto) {
    const name = dto.name?.trim();
    if (!name) {
      throw new BadRequestException('Rule name is required');
    }

    const normalizedMode = this.normalizeRuleMode(dto.billingMode);
    const customMonths =
      normalizedMode === 'custom'
        ? this.normalizePositiveInt(dto.customMonths, 1)
        : normalizedMode === 'bi_yearly'
          ? 6
          : dto.customMonths !== undefined
            ? this.normalizePositiveInt(dto.customMonths, null)
            : null;

    const rule = this.billingRulesRepository.create({
      name,
      billingModel: this.normalizeBillingModel(dto.billingModel, dto.prepaidPostpaid),
      billingType: dto.billingType ?? 'fixed',
      billingMode: normalizedMode,
      customMonths,
      fixedBillingDay:
        (dto.billingType ?? 'fixed') === 'fixed'
          ? this.normalizePositiveInt(dto.fixedBillingDay, 1)
          : null,
      dueAfterDays: this.normalizeNonNegativeInt(dto.dueAfterDays, 14),
      prepaidPostpaid: this.normalizePrepaidPostpaid(dto.prepaidPostpaid ?? dto.billingModel),
      suspendOnOverdue: dto.suspendOnOverdue ?? true,
      graceDays: this.normalizeNonNegativeInt(dto.graceDays, 0),
      lateFeeEnabled: dto.lateFeeEnabled ?? false,
      lateFeeType: dto.lateFeeType ?? 'fixed',
      lateFeeApplyMode: dto.lateFeeApplyMode ?? 'once',
      lateFeeValue: this.roundTo2(dto.lateFeeValue ?? 0).toFixed(2),
      lateFeeTriggerDays: this.normalizeNonNegativeInt(dto.lateFeeTriggerDays, 0),
      isActive: dto.isActive ?? true,
      version: 1,
    });

    const savedRule = await this.billingRulesRepository.save(rule);
    return this.mapBillingRuleForOutput(savedRule);
  }

  async updateBillingRule(ruleId: string, dto: UpdateBillingRuleDto) {
    const rule = await this.billingRulesRepository.findOne({ where: { id: ruleId } });
    if (!rule) {
      throw new NotFoundException('Billing rule not found');
    }

    if (dto.name !== undefined) {
      const normalizedName = dto.name.trim();
      if (!normalizedName) {
        throw new BadRequestException('Rule name is required');
      }
      rule.name = normalizedName;
    }

    if (dto.billingModel !== undefined || dto.prepaidPostpaid !== undefined) {
      const normalizedModel = this.normalizeBillingModel(
        dto.billingModel ?? rule.billingModel,
        dto.prepaidPostpaid ?? rule.prepaidPostpaid,
      );
      rule.billingModel = normalizedModel;
      rule.prepaidPostpaid = this.normalizePrepaidPostpaid(
        dto.prepaidPostpaid ?? (normalizedModel === 'prepaid' ? 'prepaid' : rule.prepaidPostpaid),
      );
    }

    if (dto.billingType !== undefined) {
      rule.billingType = dto.billingType;
      if (dto.billingType !== 'fixed') {
        rule.fixedBillingDay = null;
      }
    }

    if (dto.billingMode !== undefined) {
      rule.billingMode = this.normalizeRuleMode(dto.billingMode);
      if (rule.billingMode === 'bi_yearly') {
        rule.customMonths = 6;
      } else if (rule.billingMode === 'custom') {
        rule.customMonths = this.normalizePositiveInt(dto.customMonths ?? rule.customMonths, 1);
      }
    }

    if (dto.customMonths !== undefined) {
      rule.customMonths = this.normalizePositiveInt(dto.customMonths, null);
    }
    if (dto.fixedBillingDay !== undefined) {
      rule.fixedBillingDay = this.normalizePositiveInt(dto.fixedBillingDay, null);
    }
    if (dto.dueAfterDays !== undefined) {
      rule.dueAfterDays = this.normalizeNonNegativeInt(dto.dueAfterDays, 14);
    }
    if (dto.suspendOnOverdue !== undefined) {
      rule.suspendOnOverdue = dto.suspendOnOverdue;
    }
    if (dto.graceDays !== undefined) {
      rule.graceDays = this.normalizeNonNegativeInt(dto.graceDays, 0);
    }
    if (dto.lateFeeEnabled !== undefined) {
      rule.lateFeeEnabled = dto.lateFeeEnabled;
    }
    if (dto.lateFeeType !== undefined) {
      rule.lateFeeType = dto.lateFeeType;
    }
    if (dto.lateFeeApplyMode !== undefined) {
      rule.lateFeeApplyMode = dto.lateFeeApplyMode;
    }
    if (dto.lateFeeValue !== undefined) {
      rule.lateFeeValue = this.roundTo2(dto.lateFeeValue).toFixed(2);
    }
    if (dto.lateFeeTriggerDays !== undefined) {
      rule.lateFeeTriggerDays = this.normalizeNonNegativeInt(dto.lateFeeTriggerDays, 0);
    }
    if (dto.isActive !== undefined) {
      rule.isActive = dto.isActive;
    }

    rule.version = (rule.version ?? 1) + 1;

    const savedRule = await this.billingRulesRepository.save(rule);
    return this.mapBillingRuleForOutput(savedRule);
  }

  async assignRuleToCustomers(pathRuleId: string | undefined, dto: AssignBillingRuleCustomersDto) {
    const ruleId = (pathRuleId ?? dto.ruleId ?? '').trim();
    if (!ruleId) {
      throw new BadRequestException('ruleId is required');
    }

    const rule = await this.billingRulesRepository.findOne({ where: { id: ruleId } });
    if (!rule) {
      throw new NotFoundException('Billing rule not found');
    }

    const customerIds = Array.from(
      new Set((dto.customerIds ?? []).map((id) => String(id).trim()).filter(Boolean)),
    );
    if (customerIds.length === 0) {
      throw new BadRequestException('At least one customer is required');
    }

    const customers = await this.customersRepository.find({
      where: customerIds.map((id) => ({ id })),
    });

    for (const customer of customers) {
      customer.billingRuleId = rule.id;
      customer.billingRuleName = rule.name;
    }
    if (customers.length > 0) {
      await this.customersRepository.save(customers);
    }

    const applyToUnreleased = dto.applyToUnreleasedInvoices !== false;
    let invoiceUpdatedCount = 0;
    if (applyToUnreleased) {
      const updateResult = await this.billsRepository
        .createQueryBuilder()
        .update(Bill)
        .set({
          billingRuleId: rule.id,
          billingRuleName: rule.name,
        })
        .where('customer_id IN (:...customerIds)', { customerIds })
        .andWhere('status NOT IN (:...lockedStatuses)', {
          lockedStatuses: ['paid', 'cancelled'],
        })
        .execute();
      invoiceUpdatedCount = updateResult.affected ?? 0;
    }

    return {
      ruleId: rule.id,
      ruleName: rule.name,
      updatedCount: customers.length,
      invoiceUpdatedCount,
      effectiveFrom: dto.effectiveFrom ?? null,
    };
  }

  async assignRuleToInvoices(pathRuleId: string | undefined, dto: AssignBillingRuleInvoicesDto) {
    const ruleId = (pathRuleId ?? dto.ruleId ?? '').trim();
    if (!ruleId) {
      throw new BadRequestException('ruleId is required');
    }

    const rule = await this.billingRulesRepository.findOne({ where: { id: ruleId } });
    if (!rule) {
      throw new NotFoundException('Billing rule not found');
    }

    const invoiceIds = Array.from(
      new Set((dto.invoiceIds ?? []).map((id) => String(id).trim()).filter(Boolean)),
    );
    if (invoiceIds.length === 0) {
      throw new BadRequestException('At least one invoice is required');
    }

    const updateResult = await this.billsRepository
      .createQueryBuilder()
      .update(Bill)
      .set({
        billingRuleId: rule.id,
        billingRuleName: rule.name,
      })
      .where('id IN (:...invoiceIds)', { invoiceIds })
      .execute();

    return {
      ruleId: rule.id,
      ruleName: rule.name,
      updatedCount: updateResult.affected ?? 0,
      recalculate: dto.recalculate === true,
    };
  }

  async getInvoices(customerId?: string) {
    const initialInvoices = await this.billsRepository.find({
      where: customerId ? ({ customer: { id: customerId } } as never) : undefined,
      relations: {
        customer: true,
        subscription: {
          plan: true,
        },
        adjustments: true,
      },
      order: {
        issuedAt: 'DESC',
      },
    });

    const customerIds = Array.from(
      new Set(
        initialInvoices
          .map((invoice) => String(invoice.customer?.id ?? '').trim())
          .filter(Boolean),
      ),
    );

    for (const customerIdToSync of customerIds) {
      await this.syncCustomerServiceStatus(customerIdToSync);
    }

    return this.billsRepository.find({
      where: customerId ? ({ customer: { id: customerId } } as never) : undefined,
      relations: {
        customer: true,
        subscription: {
          plan: true,
        },
        adjustments: true,
      },
      order: {
        issuedAt: 'DESC',
      },
    });
  }

  async getReceipts() {
    const invoicesWithReceipts = await this.billsRepository.find({
      where: {
        receiptNo: Not(IsNull()),
      },
      relations: {
        customer: true,
        subscription: {
          plan: true,
        },
      },
      order: {
        paidAt: 'DESC',
        issuedAt: 'DESC',
      },
    });

    return invoicesWithReceipts.filter((invoice) => Boolean(invoice.receiptNo?.trim()));
  }

  async generateReceiptForInvoice(invoiceId: string, dto?: CreateReceiptDto) {
    const invoice = await this.billsRepository.findOne({
      where: { id: invoiceId },
      relations: {
        customer: true,
        subscription: {
          plan: true,
        },
        adjustments: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    const invoiceStatus = String(invoice.status ?? '').trim().toLowerCase();
    const receiptStatus = String(invoice.receiptStatus ?? '').trim().toLowerCase();
    const hasReceiptNo = Boolean(invoice.receiptNo?.trim());
    const isCancelledReceiptState = receiptStatus === 'cancelled' || (invoiceStatus === 'cancelled' && hasReceiptNo);

    if (invoiceStatus === 'carried_forward') {
      throw new BadRequestException('Carried-forward invoice cannot generate receipt');
    }

    if (invoiceStatus === 'cancelled' && !isCancelledReceiptState) {
      throw new BadRequestException('Cancelled invoice cannot generate receipt');
    }

    const requestedPaymentMethod = dto?.paymentMethod?.trim() || null;
    const paymentMethodFromCollection = this.extractPaymentMethodFromCollectionEvents(invoice);
    const resolvedPaymentMethod =
      requestedPaymentMethod ||
      invoice.paymentMethod ||
      paymentMethodFromCollection ||
      null;

    if (invoiceStatus !== 'paid' && !isCancelledReceiptState) {
      if (!resolvedPaymentMethod) {
        throw new BadRequestException(
          'Payment method is required to create receipt for unpaid invoice',
        );
      }

      const paidAt = dto?.paidAt ? new Date(dto.paidAt) : new Date();
      invoice.status = 'paid';
      invoice.paidAt = paidAt;
      invoice.paymentMethod = resolvedPaymentMethod;
      invoice.collectionStatus = 'completed';
      invoice.collectionUpdatedAt = paidAt;

      const collectionEvents = this.getCollectionEvents(invoice);
      const collectionEventTimestamp = paidAt.toISOString();
      collectionEvents.push({
        id: this.generateCollectionEventId(collectionEventTimestamp),
        type: 'admin_confirmed',
        label: `Admin confirmed payment received via ${resolvedPaymentMethod}.`,
        note: dto?.receiptNo?.trim()
          ? `Receipt: ${dto.receiptNo.trim()}`
          : undefined,
        timestamp: collectionEventTimestamp,
        actorName: 'admin',
        actorRole: 'admin',
      });
      invoice.collectionEvents = collectionEvents;
    } else {
      if (invoiceStatus === 'cancelled' && isCancelledReceiptState) {
        invoice.status = 'paid';
      }
      if (!invoice.paidAt) {
        invoice.paidAt = dto?.paidAt ? new Date(dto.paidAt) : new Date();
      }
      invoice.collectionStatus = 'completed';
      invoice.collectionUpdatedAt = invoice.paidAt ?? new Date();
      if (resolvedPaymentMethod) {
        invoice.paymentMethod = resolvedPaymentMethod;
      }
    }

    const previousCancelledReceiptNo = isCancelledReceiptState ? invoice.receiptNo?.trim() || null : null;

    const manualReceiptNo = dto?.receiptNo?.trim() || '';
    if (manualReceiptNo) {
      const manualReceiptCore = this.extractDocumentCore(manualReceiptNo);
      const invoiceCore = this.extractDocumentCore(invoice.invoiceNo);
      if (manualReceiptCore && invoiceCore && manualReceiptCore === invoiceCore) {
        throw new BadRequestException(
          'Manual receipt number cannot match invoice number. Leave receipt number blank for auto generation.',
        );
      }
      invoice.receiptNo = manualReceiptNo;
    }

    const mustIssueNewReceiptNo =
      !invoice.receiptNo ||
      isCancelledReceiptState ||
      receiptStatus === 'cancelled';

    if (mustIssueNewReceiptNo && !dto?.receiptNo?.trim()) {
      invoice.receiptNo = await this.generateReceiptNo(invoice.paidAt ?? new Date(), invoice.id);
    }

    invoice.receiptStatus = 'issued';

    if (previousCancelledReceiptNo && previousCancelledReceiptNo !== invoice.receiptNo) {
      const collectionEvents = this.getCollectionEvents(invoice);
      const eventTimestamp = new Date().toISOString();
      collectionEvents.push({
        id: this.generateCollectionEventId(eventTimestamp),
        type: 'admin_confirmed',
        label: `Receipt re-issued. Previous cancelled receipt: ${previousCancelledReceiptNo}.`,
        note: invoice.receiptNo ? `New receipt: ${invoice.receiptNo}` : undefined,
        timestamp: eventTimestamp,
        actorName: 'admin',
        actorRole: 'admin',
      });
      invoice.collectionEvents = collectionEvents;
    }

    await this.billsRepository.save(invoice);

    await this.activateCustomerAndUser(invoice.customer);

    return this.getInvoiceById(invoice.id);
  }

  async getInvoiceById(invoiceId: string) {
    const invoice = await this.billsRepository.findOne({
      where: { id: invoiceId },
      relations: {
        customer: true,
        subscription: {
          plan: true,
        },
        adjustments: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    return invoice;
  }

  async updateInvoiceAdjustments(
    invoiceId: string,
    dto: UpdateInvoiceAdjustmentsDto,
  ) {
    const invoice = await this.billsRepository.findOne({
      where: { id: invoiceId },
      relations: {
        customer: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    await this.applyAdjustmentsToInvoice(invoice, dto.adjustments, true);

    return this.getInvoiceById(invoice.id);
  }

  async getGlobalAdjustments(activeOnly = false) {
    return this.globalAdjustmentsRepository.find({
      where: activeOnly ? { isActive: true } : undefined,
      order: {
        sortOrder: 'ASC',
        createdAt: 'ASC',
      },
    });
  }

  async updateGlobalAdjustments(dto: UpdateGlobalInvoiceAdjustmentsDto) {
    const normalized = (dto.adjustments ?? []).map((adjustment, index) => ({
      description: adjustment.description.trim(),
      type: adjustment.type,
      valueType: adjustment.valueType,
      value: this.roundTo2(adjustment.value),
      sortOrder: adjustment.sortOrder ?? index,
      isActive: adjustment.isActive !== false,
    }));

    await this.globalAdjustmentsRepository
      .createQueryBuilder()
      .delete()
      .from(GlobalInvoiceAdjustment)
      .execute();

    if (normalized.length > 0) {
      const entities = normalized.map((adjustment) =>
        this.globalAdjustmentsRepository.create({
          description: adjustment.description,
          type: adjustment.type,
          valueType: adjustment.valueType,
          value: adjustment.value.toFixed(2),
          sortOrder: adjustment.sortOrder,
          isActive: adjustment.isActive,
        }),
      );
      await this.globalAdjustmentsRepository.save(entities);
    }

    return this.getGlobalAdjustments(false);
  }

  async markInvoicePaid(invoiceId: string, dto: MarkInvoicePaidDto) {
    const invoice = await this.billsRepository.findOne({
      where: { id: invoiceId },
      relations: {
        customer: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    invoice.status = 'paid';
    invoice.paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();
    const paymentMethodFromCollection = this.extractPaymentMethodFromCollectionEvents(invoice);
    invoice.paymentMethod =
      dto.paymentMethod?.trim() ||
      invoice.paymentMethod ||
      paymentMethodFromCollection ||
      null;
    const manualReceiptNo = dto.receiptNo?.trim() || '';
    if (manualReceiptNo) {
      const manualReceiptCore = this.extractDocumentCore(manualReceiptNo);
      const invoiceCore = this.extractDocumentCore(invoice.invoiceNo);
      if (manualReceiptCore && invoiceCore && manualReceiptCore === invoiceCore) {
        throw new BadRequestException(
          'Manual receipt number cannot match invoice number. Leave receipt number blank for auto generation.',
        );
      }
    }
    invoice.receiptNo = manualReceiptNo || invoice.receiptNo || null;
    if (!invoice.receiptNo) {
      invoice.receiptNo = await this.generateReceiptNo(invoice.paidAt ?? new Date(), invoice.id);
    }
    invoice.receiptStatus = 'issued';

    const collectionEventTimestamp = (invoice.paidAt ?? new Date()).toISOString();
    const collectionEvents = this.getCollectionEvents(invoice);
    const confirmedLabel = dto.paymentMethod?.trim()
      ? `Admin confirmed payment received via ${dto.paymentMethod.trim()}.`
      : 'Admin confirmed payment received and completed the invoice.';
    collectionEvents.push({
      id: this.generateCollectionEventId(collectionEventTimestamp),
      type: 'admin_confirmed',
      label: confirmedLabel,
      note: dto.receiptNo?.trim()
        ? `Receipt: ${dto.receiptNo.trim()}`
        : undefined,
      timestamp: collectionEventTimestamp,
      actorName: 'admin',
      actorRole: 'admin',
    });
    invoice.collectionStatus = 'completed';
    invoice.collectionUpdatedAt = invoice.paidAt ?? new Date();
    invoice.collectionEvents = collectionEvents;

    await this.billsRepository.save(invoice);

    await this.activateCustomerAndUser(invoice.customer);

    return this.getInvoiceById(invoice.id);
  }

  async cancelInvoice(invoiceId: string) {
    const invoice = await this.billsRepository.findOne({
      where: { id: invoiceId },
      relations: {
        customer: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    const currentStatus = String(invoice.status ?? '').trim().toLowerCase();
    const currentCollectionStatus = String(invoice.collectionStatus ?? '').trim().toLowerCase();
    const currentReceiptStatus = String(invoice.receiptStatus ?? '').trim().toLowerCase();
    const hasReceipt = Boolean(invoice.receiptNo?.trim());

    if (hasReceipt && currentReceiptStatus !== 'cancelled') {
      throw new BadRequestException('Invoice with active receipt cannot be cancelled');
    }

    if (
      currentStatus === 'paid' &&
      currentCollectionStatus === 'completed' &&
      currentReceiptStatus !== 'cancelled'
    ) {
      throw new BadRequestException('Paid and collected invoice cannot be cancelled');
    }

    if (currentStatus === 'paid' && currentReceiptStatus !== 'cancelled') {
      throw new BadRequestException('Paid invoice cannot be cancelled');
    }

    if (currentStatus !== 'cancelled') {
      invoice.status = 'cancelled';
      invoice.receiptStatus = 'none';
      await this.billsRepository.save(invoice);
    }

    return this.getInvoiceById(invoice.id);
  }

  async cancelReceipt(invoiceId: string) {
    const invoice = await this.billsRepository.findOne({
      where: { id: invoiceId },
      relations: {
        customer: true,
        subscription: {
          plan: true,
        },
        adjustments: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    const currentReceiptNo = invoice.receiptNo?.trim() || null;
    if (!currentReceiptNo) {
      throw new BadRequestException('Receipt not found for this invoice');
    }

    const receiptStatus = String(invoice.receiptStatus ?? '').trim().toLowerCase();
    if (receiptStatus === 'cancelled') {
      return this.getInvoiceById(invoice.id);
    }

    const currentStatus = String(invoice.status ?? '').trim().toLowerCase();
    if (currentStatus === 'cancelled') {
      invoice.status = 'paid';
    }

    invoice.receiptStatus = 'cancelled';
    invoice.collectionStatus = 'completed';
    invoice.collectionUpdatedAt = new Date();

    const collectionEvents = this.getCollectionEvents(invoice);
    const eventTimestamp = new Date().toISOString();
    collectionEvents.push({
      id: this.generateCollectionEventId(eventTimestamp),
      type: 'admin_confirmed',
      label: `Receipt ${currentReceiptNo} cancelled by admin.`,
      note: `Cancelled receipt: ${currentReceiptNo}`,
      timestamp: eventTimestamp,
      actorName: 'admin',
      actorRole: 'admin',
    });
    invoice.collectionEvents = collectionEvents;

    await this.billsRepository.save(invoice);

    return this.getInvoiceById(invoice.id);
  }

  async updateInvoiceCollectionWorkflow(
    invoiceId: string,
    dto: UpdateInvoiceCollectionDto,
    paymentSlipFile?: UploadedQrFile,
    baseUrl?: string,
  ) {
    const invoice = await this.billsRepository.findOne({
      where: { id: invoiceId },
      relations: {
        customer: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    const invoiceStatus = String(invoice.status ?? '').trim().toLowerCase();
    if (invoiceStatus === 'paid' && dto.status !== 'completed') {
      throw new BadRequestException('Paid invoice collection flow cannot be changed');
    }

    const eventTimestamp = this.resolveCollectionEventTimestamp(dto.timestamp);
    const collectionEvents = this.getCollectionEvents(invoice);
    let paymentSlipPath: string | undefined;
    if (paymentSlipFile) {
      paymentSlipPath = await this.persistUploadedPaymentSlip(paymentSlipFile);
    }
    const eventId = this.generateCollectionEventId(eventTimestamp);
    collectionEvents.push({
      id: eventId,
      type: dto.type,
      label: dto.label.trim(),
      note: dto.note?.trim() || undefined,
      timestamp: eventTimestamp,
      actorName: dto.actorName?.trim() || undefined,
      actorRole: dto.actorRole?.trim() || undefined,
      paymentSlipPath,
      paymentSlipUrl: paymentSlipPath
        ? this.resolveInvoicePaymentSlipUrl(invoice.id, eventId, baseUrl)
        : undefined,
    });

    invoice.collectionStatus = dto.status;
    invoice.collectionUpdatedAt = new Date(eventTimestamp);
    invoice.collectionEvents = collectionEvents;
    const paymentMethodFromRequest = dto.paymentMethod?.trim();
    const paymentMethodFromNote = this.extractPaymentMethodFromCollectionNote(dto.note);
    const resolvedPaymentMethod = paymentMethodFromRequest || paymentMethodFromNote;
    if (resolvedPaymentMethod) {
      invoice.paymentMethod = resolvedPaymentMethod;
    }

    await this.billsRepository.save(invoice);

    return this.getInvoiceById(invoice.id);
  }


  async generateInvoiceForCustomer(
    customerId: string,
    options?: GenerateInvoiceDto,
  ) {
    const customer = await this.customersRepository.findOne({
      where: { id: customerId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const replaceInvoiceId = String(options?.replaceInvoiceId ?? '').trim();
    if (replaceInvoiceId) {
      const invoiceToReplace = await this.billsRepository.findOne({
        where: {
          id: replaceInvoiceId,
          customer: { id: customerId },
        },
      });

      if (!invoiceToReplace) {
        throw new NotFoundException('Invoice to replace not found');
      }

      if (String(invoiceToReplace.status ?? '').trim().toLowerCase() !== 'cancelled') {
        invoiceToReplace.status = 'cancelled';
        // Ensure UI displays this as cancelled invoice after edit flow.
        invoiceToReplace.receiptStatus = 'none';
        await this.billsRepository.save(invoiceToReplace);
      }
    }

    const latestSubscription = await this.subscriptionsRepository.findOne({
      where: { customer: { id: customerId } },
      relations: {
        plan: true,
      },
      order: {
        createdAt: 'DESC',
      },
    });

    if (!latestSubscription?.plan) {
      throw new BadRequestException('Customer has no active subscription plan');
    }

    const invoiceHistory = await this.billsRepository.find({
      where: { customer: { id: customerId } },
      order: { issuedAt: 'DESC' },
    });
    const latestInvoice =
      invoiceHistory.find((invoiceCandidate) => {
        const normalizedStatus = this.normalizeInvoiceOperationalStatus(invoiceCandidate.status);
        return normalizedStatus !== 'cancelled' && normalizedStatus !== 'carried_forward';
      }) ?? null;
    const isManualOneTime = options?.manualOneTime === true;
    const now = new Date();
    const invoiceDateText = this.toDateString(now);

    if (isManualOneTime) {
      const resolvedDueAfterDays = this.resolveDueAfterDays(options?.dueAfterDays, 7);
      const invoice = this.billsRepository.create({
        customer,
        subscription: latestSubscription,
        invoiceNo: await this.generateInvoiceNo(now),
        invoiceType: 'manual_one_time',
        invoiceDate: invoiceDateText,
        billingPeriodFrom: invoiceDateText,
        billingPeriodTo: invoiceDateText,
        billingCycle: BillingCycle.CUSTOM,
        customBillingMonths: 1,
        billingMonth: invoiceDateText.slice(0, 7),
        billingDay: now.getDate(),
        dueAfterDays: resolvedDueAfterDays,
        billingRuleId: null,
        billingRuleName: null,
        currency: latestSubscription.plan.currency ?? 'MMK',
        monthlyFee: '0.00',
        installationFee: '0.00',
        additionalFees: '0.00',
        collectionFee: '0.00',
        discountAmount: '0.00',
        subtotalAmount: '0.00',
        plusAmount: '0.00',
        minusAmount: '0.00',
        totalAmount: '0.00',
        status: 'unpaid',
        collectionStatus: 'idle',
        collectionEvents: [],
        collectionUpdatedAt: null,
        dueDate: this.toDateString(this.addDays(now, resolvedDueAfterDays)),
      });

      const savedManualInvoice = await this.billsRepository.save(invoice);
      return this.getInvoiceById(savedManualInvoice.id);
    }

    const latestInvoiceHasCarriedForwardBalance = latestInvoice
      ? await this.invoiceHasCarriedForwardBalance(latestInvoice.id)
      : false;

    if (
      latestInvoice &&
      latestInvoiceHasCarriedForwardBalance &&
      !this.isInvoiceClosedStatus(latestInvoice.status)
    ) {
      throw new BadRequestException(
        'Latest carried-forward invoice must be paid before generating the next invoice',
      );
    }

    const requestedRuleId = (
      options?.billingRuleId?.trim() ||
      customer.billingRuleId?.trim() ||
      ''
    ).trim();
    const assignedRule = requestedRuleId
      ? await this.billingRulesRepository.findOne({ where: { id: requestedRuleId } })
      : null;
    const effectiveBillingMode = options?.billingMode ?? assignedRule?.billingMode;
    const normalizedRequestedFirstMode = String(options?.firstInvoiceMode ?? '')
      .trim()
      .toLowerCase();
    const normalizedRuleFirstMode = String(assignedRule?.billingType ?? '')
      .trim()
      .toLowerCase();
    const effectiveFirstInvoiceMode =
      normalizedRequestedFirstMode === 'fixed' || normalizedRequestedFirstMode === 'anniversary'
        ? normalizedRequestedFirstMode
        : normalizedRuleFirstMode === 'fixed'
          ? 'fixed'
          : 'anniversary';

    const billingAnchorDate =
      this.parseDateOnly(latestSubscription.contractStartDate) ??
      this.parseDateOnly(latestSubscription.serviceStartDate) ??
      now;
    const resolvedFixedStartDay =
      this.normalizePositiveInt(
        options?.fixedStartDay,
        this.normalizePositiveInt(assignedRule?.fixedBillingDay, 1),
      ) ?? 1;
    const resolvedCycle = this.resolveBillingCycle(
      options?.billingCycle,
      effectiveBillingMode,
      latestInvoice?.billingCycle ?? null,
    );
    const inferredRuleCustomMonths = this.inferCustomMonthsFromRuleName(
      assignedRule?.name,
    );
    const resolvedCustomMonths = this.resolveCustomMonths(
      options?.customMonths,
      resolvedCycle,
      latestInvoice?.customBillingMonths ??
        assignedRule?.customMonths ??
        inferredRuleCustomMonths ??
        null,
    );
    const period = this.resolveNextBillingPeriod(
      latestInvoice,
      resolvedCycle,
      billingAnchorDate,
      resolvedCustomMonths,
      effectiveFirstInvoiceMode,
      resolvedFixedStartDay,
    );
    const periodStartDate = this.parseDateOnly(period.from) ?? now;
    const periodEndDate = this.parseDateOnly(period.to) ?? periodStartDate;
    const resolvedDueAfterDays = this.resolveDueAfterDays(
      options?.dueAfterDays,
      latestInvoice?.dueAfterDays ?? assignedRule?.dueAfterDays ?? undefined,
    );
    const normalizedFirstFixedChargeMode = String(
      options?.fixedFirstInvoiceChargeMode ?? '',
    )
      .trim()
      .toLowerCase();
    const effectiveFirstFixedChargeMode =
      normalizedFirstFixedChargeMode === 'full_month' ||
      normalizedFirstFixedChargeMode === 'prorated'
        ? normalizedFirstFixedChargeMode
        : 'prorated';
    const resolvedFixedDueDay =
      this.normalizePositiveInt(
        options?.fixedDueDay,
        this.normalizePositiveInt(latestInvoice?.billingDay, resolvedFixedStartDay),
      ) ?? 15;
    const resolvedInvoiceBillingDay =
      effectiveFirstInvoiceMode === 'fixed'
        ? resolvedFixedDueDay
        : latestInvoice?.billingDay ?? periodStartDate.getDate();
    const resolvedDueDate =
      effectiveFirstInvoiceMode === 'fixed'
        ? this.getNextDayOccurrence(periodStartDate, resolvedFixedDueDay)
        : this.addDays(periodStartDate, resolvedDueAfterDays);

    const monthlyFee = this.toNumber(latestSubscription.plan.monthlyFee);
    const cycleMonths = this.getCycleMonths(resolvedCycle, resolvedCustomMonths);
    const isFirstInvoice = !latestInvoice;
    const shouldProrateFirstFixedInvoice =
      isFirstInvoice &&
      effectiveFirstInvoiceMode === 'fixed' &&
      effectiveFirstFixedChargeMode === 'prorated';
    const shouldUseFullMonthFirstFixedInvoice =
      isFirstInvoice &&
      effectiveFirstInvoiceMode === 'fixed' &&
      effectiveFirstFixedChargeMode === 'full_month';
    const cycleFee = shouldProrateFirstFixedInvoice
      ? this.roundTo2(
          (monthlyFee * this.daysBetweenInclusive(periodStartDate, periodEndDate)) /
            this.daysInMonth(periodStartDate),
        )
      : shouldUseFullMonthFirstFixedInvoice
        ? this.roundTo2(monthlyFee)
        : this.roundTo2(monthlyFee * cycleMonths);
    const openCarryForwardInvoices = await this.billsRepository.find({
      where: { customer: { id: customerId } },
      relations: {
        customer: true,
      },
      order: {
        issuedAt: 'ASC',
      },
    });
    const carryForwardInvoices = openCarryForwardInvoices.filter((invoiceCandidate) => {
      if (!invoiceCandidate.id || invoiceCandidate.id === replaceInvoiceId) return false;
      const normalizedStatus = this.normalizeInvoiceOperationalStatus(invoiceCandidate.status);
      return normalizedStatus === 'unpaid' || normalizedStatus === 'overdue';
    });
    const installationFee = isFirstInvoice
      ? this.roundTo2(this.toNumber(customer.defaultInstallationFee))
      : 0;
    const recurringCollectionFee = customer.collectionServiceEnabled
      ? this.roundTo2(this.toNumber(customer.collectionFee))
      : 0;
    const additionalFees = this.roundTo2(
      isFirstInvoice ? this.toNumber(customer.defaultAdditionalFees) : 0,
    );
    const collectionFee = this.roundTo2(recurringCollectionFee);
    const subtotalAmount = this.roundTo2(cycleFee + installationFee + additionalFees + collectionFee);

    const invoice = this.billsRepository.create({
      customer,
      subscription: latestSubscription,
      invoiceNo: await this.generateInvoiceNo(now),
      invoiceType: 'auto',
      invoiceDate: invoiceDateText,
      billingPeriodFrom: period.from,
      billingPeriodTo: period.to,
      billingCycle: resolvedCycle,
      customBillingMonths: resolvedCycle === BillingCycle.CUSTOM ? resolvedCustomMonths : null,
      billingMonth: period.from.slice(0, 7),
      billingDay: resolvedInvoiceBillingDay,
      dueAfterDays: resolvedDueAfterDays,
      billingRuleId: requestedRuleId || null,
      billingRuleName:
        options?.billingRuleName?.trim() || assignedRule?.name?.trim() || customer.billingRuleName || null,
      currency: latestSubscription.plan.currency ?? 'MMK',
      monthlyFee: cycleFee.toFixed(2),
      installationFee: installationFee.toFixed(2),
      additionalFees: additionalFees.toFixed(2),
      collectionFee: collectionFee.toFixed(2),
      discountAmount: '0',
      subtotalAmount: subtotalAmount.toFixed(2),
      plusAmount: '0',
      minusAmount: '0',
      totalAmount: subtotalAmount.toFixed(2),
      status: 'unpaid',
      collectionStatus: 'idle',
      collectionEvents: [],
      collectionUpdatedAt: null,
      dueDate: this.toDateString(resolvedDueDate),
    });

    const savedInvoice = await this.billsRepository.save(invoice);

    const carryForwardAdjustments: InvoiceAdjustmentInputDto[] = carryForwardInvoices.map((carriedInvoice, index) => ({
      description: `Previous unpaid balance - ${carriedInvoice.invoiceNo ?? carriedInvoice.id}`,
      type: AdjustmentType.PLUS,
      valueType: AdjustmentValueType.FIXED,
      value: this.roundTo2(this.toNumber(carriedInvoice.totalAmount)),
      rememberForNext: false,
      sortOrder: 10_000 + index,
    }));

    const nextInvoice = await this.applyAutomaticAdjustmentsToInvoice(
      savedInvoice.id,
      carryForwardAdjustments,
    );

    if (carryForwardInvoices.length > 0) {
      const carryEventTimestamp = new Date().toISOString();
      for (const carriedInvoice of carryForwardInvoices) {
        carriedInvoice.status = 'carried_forward';
        carriedInvoice.collectionEvents = [
          ...this.getCollectionEvents(carriedInvoice),
          {
            id: this.generateCollectionEventId(carryEventTimestamp),
            type: 'admin_confirmed',
            label: `Balance carried forward to ${nextInvoice.invoiceNo ?? savedInvoice.invoiceNo ?? savedInvoice.id}.`,
            note: `Carried amount: ${this.roundTo2(this.toNumber(carriedInvoice.totalAmount)).toFixed(2)} ${carriedInvoice.currency ?? savedInvoice.currency ?? 'MMK'}`,
            timestamp: carryEventTimestamp,
            actorName: 'system',
            actorRole: 'system',
          },
        ];
      }
      await this.billsRepository.save(carryForwardInvoices);
    }

    await this.syncCustomerServiceStatus(customer.id);

    return this.getInvoiceById(savedInvoice.id);
  }


  async applyAutomaticAdjustmentsToInvoice(
    invoiceId: string,
    extraAdjustments: InvoiceAdjustmentInputDto[] = [],
  ) {
    const invoice = await this.billsRepository.findOne({
      where: { id: invoiceId },
      relations: {
        customer: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    const recurringAdjustments = await this.recurringAdjustmentsRepository.find({
      where: {
        customer: { id: invoice.customer.id },
        isActive: true,
      },
      order: {
        sortOrder: 'ASC',
        createdAt: 'ASC',
      },
    });

    const globalAdjustments = await this.getGlobalAdjustments(true);
    const globalDtos: InvoiceAdjustmentInputDto[] = globalAdjustments.map(
      (adjustment, index) => ({
        description: adjustment.description,
        type: adjustment.type,
        valueType: adjustment.valueType,
        value: this.toNumber(adjustment.value),
        rememberForNext: false,
        sortOrder: adjustment.sortOrder ?? index,
      }),
    );
    const recurringDtos: InvoiceAdjustmentInputDto[] = recurringAdjustments.map(
      (adjustment, index) => ({
        description: adjustment.description,
        type: adjustment.type,
        valueType: adjustment.valueType,
        value: this.toNumber(adjustment.value),
        rememberForNext: true,
        sortOrder: adjustment.sortOrder ?? index,
      }),
    );

    const autoAdjustments = [...globalDtos, ...recurringDtos, ...extraAdjustments].sort(
      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
    );

    if (autoAdjustments.length > 0) {
      await this.applyAdjustmentsToInvoice(invoice, autoAdjustments, false);
    }

    return this.getInvoiceById(invoice.id);
  }

  private async applyAdjustmentsToInvoice(
    invoice: Bill,
    adjustments: InvoiceAdjustmentInputDto[],
    syncRecurring: boolean,
  ) {
    const baseSubtotal =
      this.toNumber(invoice.monthlyFee) +
      this.toNumber(invoice.installationFee) +
      this.toNumber(invoice.additionalFees) +
      this.toNumber((invoice as any).collectionFee);

    const fixedDiscount = this.toNumber(invoice.discountAmount);
    const orderedAdjustments = [...adjustments].sort(
      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
    );

    let dynamicPlus = 0;
    let dynamicMinus = 0;

    const prepared = orderedAdjustments.map((adjustment, index) => {
      const rawValue = this.roundTo2(adjustment.value);
      const computedAmount =
        adjustment.valueType === AdjustmentValueType.PERCENT
          ? this.roundTo2((baseSubtotal * rawValue) / 100)
          : rawValue;

      if (adjustment.type === AdjustmentType.PLUS) {
        dynamicPlus += computedAmount;
      } else {
        dynamicMinus += computedAmount;
      }

      return {
        description: adjustment.description.trim(),
        type: adjustment.type,
        valueType: adjustment.valueType,
        value: rawValue,
        amount: computedAmount,
        rememberForNext: Boolean(adjustment.rememberForNext),
        sortOrder: adjustment.sortOrder ?? index,
      };
    });

    const plusAmount = this.roundTo2(dynamicPlus);
    const minusAmount = this.roundTo2(fixedDiscount + dynamicMinus);
    const totalAmount = this.roundTo2(baseSubtotal + plusAmount - minusAmount);

    if (totalAmount < 0) {
      throw new BadRequestException('Total amount cannot be negative');
    }

    await this.billAdjustmentsRepository
      .createQueryBuilder()
      .delete()
      .from(BillAdjustment)
      .where('bill_id = :billId', { billId: invoice.id })
      .execute();

    if (prepared.length > 0) {
      const entities = prepared.map((adjustment) =>
        this.billAdjustmentsRepository.create({
          bill: invoice,
          customer: invoice.customer,
          description: adjustment.description,
          type: adjustment.type,
          valueType: adjustment.valueType,
          value: adjustment.value.toFixed(2),
          amount: adjustment.amount.toFixed(2),
          rememberForNext: adjustment.rememberForNext,
          sortOrder: adjustment.sortOrder,
        }),
      );

      await this.billAdjustmentsRepository.save(entities);

      if (syncRecurring) {
        await this.syncRecurringAdjustments(invoice.customer, entities);
      }
    } else if (syncRecurring) {
      await this.syncRecurringAdjustments(invoice.customer, []);
    }

    invoice.subtotalAmount = baseSubtotal.toFixed(2);
    invoice.plusAmount = plusAmount.toFixed(2);
    invoice.minusAmount = minusAmount.toFixed(2);
    invoice.totalAmount = totalAmount.toFixed(2);

    await this.billsRepository.save(invoice);
  }

  private async syncRecurringAdjustments(
    customer: Customer,
    adjustments: BillAdjustment[],
  ) {
    await this.recurringAdjustmentsRepository
      .createQueryBuilder()
      .delete()
      .from(CustomerRecurringAdjustment)
      .where('customer_id = :customerId', { customerId: customer.id })
      .execute();

    const recurringEntries = adjustments.filter((adjustment) => adjustment.rememberForNext);
    if (recurringEntries.length === 0) {
      return;
    }

    const entities = recurringEntries.map((adjustment, index) =>
      this.recurringAdjustmentsRepository.create({
        customer,
        description: adjustment.description,
        type: adjustment.type,
        valueType: adjustment.valueType,
        value: adjustment.value,
        sortOrder: adjustment.sortOrder ?? index,
        isActive: true,
      }),
    );

    await this.recurringAdjustmentsRepository.save(entities);
  }


  private async generateReceiptNo(
    referenceDate: Date = new Date(),
    excludeInvoiceId?: string,
  ): Promise<string> {
    const month = String(referenceDate.getMonth() + 1).padStart(2, '0');
    const year = String(referenceDate.getFullYear()).slice(-2);
    const prefixCore = `${month}${year}`;
    const prefixed = `RC${prefixCore}`;

    const latest = await this.billsRepository
      .createQueryBuilder('bill')
      .select('bill.receiptNo', 'receiptNo')
      .where('bill.receiptNo LIKE :prefixed', { prefixed: `${prefixed}%` })
      .orWhere('bill.receiptNo LIKE :legacy', { legacy: `RC-${prefixCore}%` })
      .orderBy('bill.receiptNo', 'DESC')
      .limit(1)
      .getRawOne<{ receiptNo?: string }>();

    const lastCode = (latest?.receiptNo ?? '').trim().toUpperCase();
    let lastNumber = 0;
    const compactMatch = lastCode.match(/^RC(\d{4})(\d+)$/);
    const hyphenMatch = lastCode.match(/^RC-(\d{4})(\d+)$/);

    if (compactMatch?.[1] === prefixCore) {
      lastNumber = Number.parseInt(compactMatch[2], 10);
    } else if (hyphenMatch?.[1] === prefixCore) {
      lastNumber = Number.parseInt(hyphenMatch[2], 10);
    }

    let nextNumber = Number.isNaN(lastNumber) ? 1 : lastNumber + 1;
    while (true) {
      const candidate = `${prefixed}${String(nextNumber).padStart(4, '0')}`;
      const builder = this.billsRepository
        .createQueryBuilder('bill')
        .where('UPPER(bill.receiptNo) = :receiptNo', {
          receiptNo: candidate,
        });

      if (excludeInvoiceId) {
        builder.andWhere('bill.id != :excludeInvoiceId', { excludeInvoiceId });
      }

      const exists = (await builder.getCount()) > 0;
      if (!exists) {
        return candidate;
      }

      nextNumber += 1;
    }
  }

  private async generateInvoiceNo(referenceDate: Date = new Date()): Promise<string> {
    const month = String(referenceDate.getMonth() + 1).padStart(2, '0');
    const year = String(referenceDate.getFullYear()).slice(-2);
    const prefixCore = `${month}${year}`;
    const prefixed = `INV-${prefixCore}`;

    const latest = await this.billsRepository
      .createQueryBuilder('bill')
      .select('bill.invoiceNo', 'invoiceNo')
      .where('bill.invoiceNo LIKE :prefixed', { prefixed: `${prefixed}%` })
      .orWhere('bill.invoiceNo LIKE :legacy', { legacy: `${prefixCore}%` })
      .orderBy('bill.invoiceNo', 'DESC')
      .limit(1)
      .getRawOne<{ invoiceNo?: string }>();

    const lastCode = (latest?.invoiceNo ?? '').trim();
    const normalized = lastCode.toUpperCase().startsWith('INV-')
      ? lastCode.slice(4)
      : lastCode;
    const matched = normalized.match(/^(\d{4})(\d+)$/);
    const lastNumber = matched?.[1] === prefixCore ? Number.parseInt(matched[2], 10) : 0;
    const nextNumber = Number.isNaN(lastNumber) ? 1 : lastNumber + 1;

    return `${prefixed}${nextNumber.toString().padStart(4, '0')}`;
  }

  private getCycleMonths(cycle: BillingCycle, customMonths?: number | null): number {
    if (cycle === BillingCycle.QUARTERLY) {
      return 3;
    }
    if (cycle === BillingCycle.YEARLY) {
      return 12;
    }
    if (cycle === BillingCycle.CUSTOM) {
      const parsedCustom = Number.parseInt(String(customMonths ?? ''), 10);
      return Number.isFinite(parsedCustom) && parsedCustom > 0 ? parsedCustom : 1;
    }
    return 1;
  }

  private getBillingPeriod(
    startDate: Date,
    cycle: BillingCycle,
    customMonths?: number | null,
  ) {
    const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const months = this.getCycleMonths(cycle, customMonths);
    const endExclusive = new Date(start.getFullYear(), start.getMonth() + months, start.getDate());
    const end = this.addDays(endExclusive, -1);

    return {
      from: this.toDateString(start),
      to: this.toDateString(end),
    };
  }

  private resolveNextBillingPeriod(
    latestInvoice: Bill | null,
    cycle: BillingCycle,
    fallbackDate: Date,
    customMonths?: number | null,
    firstInvoiceMode?: string,
    fixedStartDay?: number,
  ) {
    const latestPeriodEnd = this.parseDateOnly(latestInvoice?.billingPeriodTo || '');
    if (latestPeriodEnd) {
      const nextStart = this.addDays(latestPeriodEnd, 1);
      const effectiveCustomMonths =
        cycle === BillingCycle.CUSTOM
          ? customMonths ?? latestInvoice?.customBillingMonths ?? null
          : null;
      return this.getBillingPeriod(nextStart, cycle, effectiveCustomMonths);
    }

    const normalizedMode = String(firstInvoiceMode ?? '').trim().toLowerCase();
    if (normalizedMode === 'fixed') {
      const anchorStart = new Date(
        fallbackDate.getFullYear(),
        fallbackDate.getMonth(),
        fallbackDate.getDate(),
      );
      const fixedFirstEnd = new Date(
        anchorStart.getFullYear(),
        anchorStart.getMonth() + 1,
        0,
      );
      return {
        from: this.toDateString(anchorStart),
        to: this.toDateString(fixedFirstEnd),
      };
    }

    // For first-time generation (no previous invoice), start from current day.
    const defaultStart = new Date(
      fallbackDate.getFullYear(),
      fallbackDate.getMonth(),
      fallbackDate.getDate(),
    );
    const effectiveCustomMonths = cycle === BillingCycle.CUSTOM ? customMonths ?? null : null;
    return this.getBillingPeriod(defaultStart, cycle, effectiveCustomMonths);
  }

  private resolveBillingCycle(
    directCycle: BillingCycle | undefined,
    billingMode: string | undefined,
    fallback: BillingCycle | null,
  ): BillingCycle {
    if (directCycle && Object.values(BillingCycle).includes(directCycle)) {
      return directCycle;
    }

    const normalizedMode = String(billingMode ?? '').trim().toLowerCase();
    if (normalizedMode) {
      if (normalizedMode === 'monthly') return BillingCycle.MONTHLY;
      if (normalizedMode.includes('quarter')) return BillingCycle.QUARTERLY;
      if (
        normalizedMode === 'bi-yearly' ||
        normalizedMode === 'bi_yearly' ||
        normalizedMode === 'biyearly' ||
        normalizedMode === 'semiannual' ||
        normalizedMode === 'semi-annual'
      ) {
        return BillingCycle.CUSTOM;
      }
      if (normalizedMode.includes('custom')) {
        return BillingCycle.CUSTOM;
      }
      if (
        normalizedMode.includes('yearly') ||
        normalizedMode === 'annual' ||
        normalizedMode === 'annually'
      ) {
        return BillingCycle.YEARLY;
      }
    }

    return fallback ?? BillingCycle.MONTHLY;
  }

  private resolveCustomMonths(
    inputMonths: number | undefined,
    cycle: BillingCycle,
    fallbackMonths?: number | null,
  ): number | null {
    const parsedInput = Number.parseInt(String(inputMonths ?? ''), 10);
    if (cycle === BillingCycle.CUSTOM) {
      if (Number.isFinite(parsedInput) && parsedInput > 0) {
        return parsedInput;
      }
      const parsedFallback = Number.parseInt(String(fallbackMonths ?? ''), 10);
      if (Number.isFinite(parsedFallback) && parsedFallback > 0) {
        return parsedFallback;
      }
      return 1;
    }

    if (Number.isFinite(parsedInput) && parsedInput > 0) {
      return parsedInput;
    }
    const parsedFallback = Number.parseInt(String(fallbackMonths ?? ''), 10);
    if (Number.isFinite(parsedFallback) && parsedFallback > 0) {
      return parsedFallback;
    }
    return null;
  }

  private resolveDueAfterDays(
    inputDueAfterDays: number | undefined,
    fallbackDueAfterDays?: number,
  ): number {
    const parsedInput = Number.parseInt(String(inputDueAfterDays ?? ''), 10);
    if (Number.isFinite(parsedInput) && parsedInput >= 0) {
      return parsedInput;
    }

    const parsedFallback = Number.parseInt(String(fallbackDueAfterDays ?? ''), 10);
    if (Number.isFinite(parsedFallback) && parsedFallback >= 0) {
      return parsedFallback;
    }

    return 7;
  }

  private normalizeRuleMode(value?: string | null): BillingRule['billingMode'] {
    const mode = String(value ?? '')
      .trim()
      .toLowerCase();
    if (mode === 'quarterly') return 'quarterly';
    if (mode === 'bi_yearly' || mode === 'bi-yearly' || mode === 'biyearly') {
      return 'bi_yearly';
    }
    if (mode === 'yearly' || mode === 'annual' || mode === 'annually') {
      return 'yearly';
    }
    if (mode === 'custom') return 'custom';
    return 'monthly';
  }

  private normalizePositiveInt(value: unknown, fallback: number | null): number | null {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
    return fallback;
  }

  private normalizeNonNegativeInt(value: unknown, fallback: number): number {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
    return fallback;
  }

  private inferCustomMonthsFromRuleName(ruleName?: string | null): number | null {
    const name = String(ruleName ?? '').trim();
    if (!name) return null;
    const match = name.match(/(\d+)\s*month/i);
    if (!match) return null;
    const parsed = Number.parseInt(match[1], 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  private parseDateOnly(value: string | null | undefined): Date | null {
    if (!value) return null;
    const [yearText, monthText, dayText] = value.split('-');
    const year = Number.parseInt(yearText ?? '', 10);
    const month = Number.parseInt(monthText ?? '', 10);
    const day = Number.parseInt(dayText ?? '', 10);

    if (
      !Number.isFinite(year) ||
      !Number.isFinite(month) ||
      !Number.isFinite(day) ||
      month < 1 ||
      month > 12 ||
      day < 1
    ) {
      return null;
    }

    const parsed = new Date(year, month - 1, day);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return parsed;
  }

  private toDateString(value: Date): string {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private addDays(value: Date, days: number): Date {
    const output = new Date(value);
    output.setDate(output.getDate() + days);
    return output;
  }

  private daysInMonth(value: Date): number {
    return new Date(value.getFullYear(), value.getMonth() + 1, 0).getDate();
  }

  private daysBetweenInclusive(start: Date, end: Date): number {
    const normalizedStart = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const normalizedEnd = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    const diffMs = normalizedEnd.getTime() - normalizedStart.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return Math.max(1, diffDays + 1);
  }

  private getNextFixedCycleStartDate(anchor: Date, startDay: number): Date {
    const current = this.dateAtDay(anchor.getFullYear(), anchor.getMonth(), startDay);
    if (current > anchor) {
      return current;
    }
    return this.dateAtDay(anchor.getFullYear(), anchor.getMonth() + 1, startDay);
  }

  private getNextDayOccurrence(anchor: Date, day: number): Date {
    const current = this.dateAtDay(anchor.getFullYear(), anchor.getMonth(), day);
    if (current >= anchor) {
      return current;
    }
    return this.dateAtDay(anchor.getFullYear(), anchor.getMonth() + 1, day);
  }

  private dateAtDay(year: number, monthIndex: number, day: number): Date {
    const firstDayOfMonth = new Date(year, monthIndex, 1);
    const monthDays = new Date(
      firstDayOfMonth.getFullYear(),
      firstDayOfMonth.getMonth() + 1,
      0,
    ).getDate();
    const safeDay = Math.min(Math.max(day, 1), monthDays);
    return new Date(
      firstDayOfMonth.getFullYear(),
      firstDayOfMonth.getMonth(),
      safeDay,
    );
  }

  private getCollectionEvents(invoice: Bill): InvoiceCollectionEvent[] {
    if (!Array.isArray(invoice.collectionEvents)) {
      return [];
    }

    return invoice.collectionEvents
      .filter((event) => event && typeof event === 'object')
      .map((event) => ({
        id: String(event.id ?? this.generateCollectionEventId(new Date().toISOString())),
        type: event.type,
        label: String(event.label ?? ''),
        note: event.note ?? undefined,
        timestamp: String(event.timestamp ?? new Date().toISOString()),
        actorName: event.actorName ?? undefined,
        actorRole: event.actorRole ?? undefined,
        paymentSlipPath: (event as InvoiceCollectionEvent).paymentSlipPath ?? undefined,
        paymentSlipUrl: (event as InvoiceCollectionEvent).paymentSlipUrl ?? undefined,
      }));
  }

  private resolveCollectionEventTimestamp(value?: string): string {
    if (!value?.trim()) return new Date().toISOString();
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
    return parsed.toISOString();
  }

  private generateCollectionEventId(timestamp: string): string {
    return `${timestamp}-${Math.random().toString(36).slice(2, 10)}`;
  }

  private async invoiceHasCarriedForwardBalance(invoiceId?: string | null) {
    const normalizedInvoiceId = String(invoiceId ?? '').trim();
    if (!normalizedInvoiceId) return false;

    const count = await this.billAdjustmentsRepository.count({
      where: {
        bill: { id: normalizedInvoiceId },
        type: AdjustmentType.PLUS,
        description: ILike('Previous unpaid balance%'),
      },
    });

    return count > 0;
  }

  private normalizeInvoiceOperationalStatus(status?: string | null) {
    const normalized = String(status ?? '').trim().toLowerCase();
    if (normalized === 'canceled') return 'cancelled';
    if (normalized === 'over_due') return 'overdue';
    return normalized;
  }

  private isInvoiceClosedStatus(status?: string | null) {
    const normalized = this.normalizeInvoiceOperationalStatus(status);
    return normalized === 'paid' || normalized === 'cancelled' || normalized === 'carried_forward';
  }

  private async syncCustomerServiceStatus(customerId?: string | null) {
    const normalizedCustomerId = String(customerId ?? '').trim();
    if (!normalizedCustomerId) return;

    const customer = await this.customersRepository.findOne({
      where: { id: normalizedCustomerId },
    });
    if (!customer) return;

    const invoices = await this.billsRepository.find({
      where: { customer: { id: normalizedCustomerId } },
      relations: {
        adjustments: true,
      },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const invoicesToSave: Bill[] = [];
    let shouldDisableCustomer = false;

    for (const invoice of invoices) {
      const normalizedStatus = this.normalizeInvoiceOperationalStatus(invoice.status);
      if (this.isInvoiceClosedStatus(normalizedStatus)) {
        continue;
      }

      const hasPreviousBalance = Array.isArray(invoice.adjustments)
        && invoice.adjustments.some((adjustment) =>
          String(adjustment.description ?? '').trim().toLowerCase().startsWith('previous unpaid balance'),
        );
      const dueDate = this.parseDateOnly(invoice.dueDate || '');
      const dueDay = dueDate
        ? new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate())
        : null;
      const isPastDue = Boolean(dueDay && dueDay.getTime() < today.getTime());

      if (normalizedStatus === 'unpaid' && isPastDue) {
        invoice.status = 'overdue';
        invoicesToSave.push(invoice);
        shouldDisableCustomer = true;
        continue;
      }

      if (normalizedStatus === 'unpaid' && hasPreviousBalance) {
        shouldDisableCustomer = true;
        continue;
      }

      if (normalizedStatus === 'overdue') {
        if (!isPastDue && hasPreviousBalance) {
          invoice.status = 'unpaid';
          invoicesToSave.push(invoice);
          shouldDisableCustomer = true;
          continue;
        }

        shouldDisableCustomer = true;
      }
    }

    if (invoicesToSave.length > 0) {
      await this.billsRepository.save(invoicesToSave);
    }

    if (customer.status !== CustomerStatus.TAKEOFF) {
      const nextStatus = shouldDisableCustomer
        ? CustomerStatus.DISABLE
        : customer.status === CustomerStatus.DISABLE
          ? CustomerStatus.ENABLE
          : customer.status;
      if (nextStatus !== customer.status) {
        customer.status = nextStatus;
        await this.customersRepository.save(customer);
      }
    }
  }

  private async activateCustomerAndUser(customer?: Customer | null) {
    if (!customer) return;

    await this.syncCustomerServiceStatus(customer.id);

    const user = await this.usersRepository.findOne({
      where: { customer: { id: customer.id } },
    });

    if (user && user.status !== UserStatus.ACTIVE) {
      user.status = UserStatus.ACTIVE;
      await this.usersRepository.save(user);
    }
  }

  private extractPaymentMethodFromCollectionNote(note?: string): string | null {
    const rawNote = String(note ?? '').trim();
    if (!rawNote) return null;

    const match = rawNote.match(/payment\s*method\s*:\s*([^|]+)/i);
    if (!match) return null;

    const value = match[1]?.trim();
    return value ? value : null;
  }

  private extractPaymentMethodFromCollectionEvents(invoice: Bill): string | null {
    const events = this.getCollectionEvents(invoice)
      .slice()
      .sort((a, b) => {
        const aTime = new Date(a.timestamp).getTime();
        const bTime = new Date(b.timestamp).getTime();
        return bTime - aTime;
      });

    for (const event of events) {
      const fromNote = this.extractPaymentMethodFromCollectionNote(event.note);
      if (fromNote) return fromNote;
    }

    return null;
  }


  private async ensurePaymentSlipStorageDir() {
    await fs.mkdir(this.paymentSlipStorageDir, { recursive: true });
  }

  private async persistUploadedPaymentSlip(file: UploadedQrFile) {
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Payment slip must be an image file');
    }
    await this.ensurePaymentSlipStorageDir();
    const extFromMime = file.mimetype.split('/')[1] || 'png';
    const ext = extFromMime.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'png';
    const fileName = `${randomUUID()}.${ext}`;
    const targetPath = path.join(this.paymentSlipStorageDir, fileName);
    await fs.writeFile(targetPath, file.buffer);
    return fileName;
  }

  private resolveInvoicePaymentSlipUrl(invoiceId: string, eventId: string, baseUrl?: string) {
    const raw = process.env.APP_PUBLIC_BASE_URL?.trim() || baseUrl?.trim() || '';
    const normalizedBase = raw ? raw.replace(/\/$/, '') : '';
    if (!normalizedBase) return null;
    return `${normalizedBase}/billing/invoices/${invoiceId}/payment-slip?eventId=${encodeURIComponent(eventId)}`;
  }

  async getInvoicePaymentSlipFile(invoiceId: string, eventId?: string) {
    const invoice = await this.billsRepository.findOne({ where: { id: invoiceId } });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    const events = this.getCollectionEvents(invoice);
    const sortedEvents = events.slice().sort((a, b) => {
      const aTime = new Date(a.timestamp).getTime();
      const bTime = new Date(b.timestamp).getTime();
      return bTime - aTime;
    });

    const matchedEvent = eventId
      ? sortedEvents.find((event) => event.id === eventId)
      : sortedEvents.find((event) => Boolean(event.paymentSlipPath));

    const relativePath = matchedEvent?.paymentSlipPath?.trim();
    if (!relativePath) {
      throw new NotFoundException('Payment slip not found');
    }

    const resolvedPath = path.resolve(this.paymentSlipStorageDir, relativePath);
    if (!resolvedPath.startsWith(path.resolve(this.paymentSlipStorageDir))) {
      throw new BadRequestException('Invalid payment slip path');
    }

    try {
      await fs.access(resolvedPath);
    } catch {
      throw new NotFoundException('Payment slip not found');
    }

    return {
      absolutePath: resolvedPath,
      fileName: path.basename(resolvedPath),
      contentType: this.detectImageContentType(resolvedPath),
    };
  }

  private toNumber(
value: string | number | null | undefined): number {
    if (value === null || value === undefined || value === '') {
      return 0;
    }

    const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }


  private extractDocumentCore(value: string | null | undefined): string {
    const raw = String(value ?? '')
      .trim()
      .toUpperCase();
    if (!raw) return '';

    const withoutPrefix = raw.replace(/^(INV|RC)-?/, '');
    const digitsOnly = withoutPrefix.replace(/[^0-9]/g, '');
    return digitsOnly || withoutPrefix;
  }

  private roundTo2(value: number): number {
    return Number.parseFloat(value.toFixed(2));
  }
}
