import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
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

  async getPaymentAccounts(activeOnly = false) {
    return this.paymentAccountsRepository.find({
      where: activeOnly ? { isActive: true } : undefined,
      order: {
        isActive: 'DESC',
        createdAt: 'DESC',
      },
    });
  }

  async createPaymentAccount(dto: CreatePaymentAccountDto) {
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
      if (!qrCodeDataUrl) {
        throw new BadRequestException('QR code is required for wallet');
      }
    }

    if (kind === PaymentAccountKind.ACCOUNT && !bankType) {
      throw new BadRequestException('Bank type is required');
    }

    const account = this.paymentAccountsRepository.create({
      kind,
      walletType: kind === PaymentAccountKind.WALLET ? walletType ?? null : null,
      bankType: kind === PaymentAccountKind.ACCOUNT ? bankType ?? null : null,
      accountName,
      accountNumber,
      qrCodeDataUrl: kind === PaymentAccountKind.WALLET ? qrCodeDataUrl ?? null : null,
      isActive: dto.isActive ?? true,
    });

    return this.paymentAccountsRepository.save(account);
  }

  async getBillingRules() {
    return this.billingRulesRepository.find({
      order: {
        isActive: 'DESC',
        updatedAt: 'DESC',
        createdAt: 'DESC',
      },
    });
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
      billingModel: dto.billingModel ?? 'recurring',
      billingType: dto.billingType ?? 'fixed',
      billingMode: normalizedMode,
      customMonths,
      fixedBillingDay:
        (dto.billingType ?? 'fixed') === 'fixed'
          ? this.normalizePositiveInt(dto.fixedBillingDay, 1)
          : null,
      dueAfterDays: this.normalizeNonNegativeInt(dto.dueAfterDays, 14),
      prepaidPostpaid: dto.prepaidPostpaid ?? 'postpaid',
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

    return this.billingRulesRepository.save(rule);
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

    if (dto.billingModel !== undefined) {
      rule.billingModel = dto.billingModel;
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
    if (dto.prepaidPostpaid !== undefined) {
      rule.prepaidPostpaid = dto.prepaidPostpaid;
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

    return this.billingRulesRepository.save(rule);
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
    const paidInvoices = await this.billsRepository.find({
      where: { status: 'paid' },
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

    return paidInvoices.filter((invoice) => Boolean(invoice.receiptNo?.trim()));
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
    if (invoiceStatus === 'cancelled') {
      throw new BadRequestException('Cancelled invoice cannot generate receipt');
    }

    const requestedPaymentMethod = dto?.paymentMethod?.trim() || null;
    const paymentMethodFromCollection = this.extractPaymentMethodFromCollectionEvents(invoice);
    const resolvedPaymentMethod =
      requestedPaymentMethod ||
      invoice.paymentMethod ||
      paymentMethodFromCollection ||
      null;

    if (invoiceStatus !== 'paid') {
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
    } else if (resolvedPaymentMethod) {
      invoice.paymentMethod = resolvedPaymentMethod;
    }

    if (dto?.receiptNo?.trim()) {
      invoice.receiptNo = dto.receiptNo.trim();
    }

    if (!invoice.receiptNo) {
      invoice.receiptNo = await this.generateReceiptNo(
        invoice.invoiceNo,
        invoice.paidAt ?? new Date(),
        invoice.id,
      );
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
    invoice.receiptNo = dto.receiptNo?.trim() || invoice.receiptNo || null;
    if (!invoice.receiptNo) {
      invoice.receiptNo = await this.generateReceiptNo(
        invoice.invoiceNo,
        invoice.paidAt ?? new Date(),
        invoice.id,
      );
    }

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
    if (currentStatus === 'paid') {
      throw new BadRequestException('Paid invoice cannot be cancelled');
    }

    if (currentStatus !== 'cancelled') {
      invoice.status = 'cancelled';
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

    const currentStatus = String(invoice.status ?? '').trim().toLowerCase();
    if (currentStatus === 'cancelled') {
      return this.getInvoiceById(invoice.id);
    }

    invoice.status = 'cancelled';
    invoice.collectionStatus = 'completed';
    invoice.collectionUpdatedAt = new Date();

    const collectionEvents = this.getCollectionEvents(invoice);
    const eventTimestamp = new Date().toISOString();
    collectionEvents.push({
      id: this.generateCollectionEventId(eventTimestamp),
      type: 'admin_confirmed',
      label: 'Receipt cancelled by admin.',
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
    collectionEvents.push({
      id: this.generateCollectionEventId(eventTimestamp),
      type: dto.type,
      label: dto.label.trim(),
      note: dto.note?.trim() || undefined,
      timestamp: eventTimestamp,
      actorName: dto.actorName?.trim() || undefined,
      actorRole: dto.actorRole?.trim() || undefined,
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

    const latestInvoice = await this.billsRepository.findOne({
      where: { customer: { id: customerId }, status: Not('cancelled') },
      order: { issuedAt: 'DESC' },
    });
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

    const monthlyFee = this.toNumber(latestSubscription.plan.monthlyFee);
    const cycleMonths = this.getCycleMonths(resolvedCycle, resolvedCustomMonths);
    const isFirstInvoice = !latestInvoice;
    const shouldProrateFirstFixedInvoice =
      isFirstInvoice && effectiveFirstInvoiceMode === 'fixed';
    const cycleFee = shouldProrateFirstFixedInvoice
      ? this.roundTo2(
          (monthlyFee * this.daysBetweenInclusive(periodStartDate, periodEndDate)) /
            this.daysInMonth(periodStartDate),
        )
      : this.roundTo2(monthlyFee * cycleMonths);
    const installationFee = isFirstInvoice
      ? this.roundTo2(this.toNumber(customer.defaultInstallationFee))
      : 0;
    const recurringCollectionFee = customer.collectionServiceEnabled
      ? this.roundTo2(this.toNumber(customer.collectionFee))
      : 0;
    const additionalFees = this.roundTo2(
      (isFirstInvoice ? this.toNumber(customer.defaultAdditionalFees) : 0) +
        recurringCollectionFee,
    );
    const subtotalAmount = this.roundTo2(cycleFee + installationFee + additionalFees);

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
      billingDay: latestInvoice?.billingDay ?? periodStartDate.getDate(),
      dueAfterDays: resolvedDueAfterDays,
      billingRuleId: requestedRuleId || null,
      billingRuleName:
        options?.billingRuleName?.trim() || assignedRule?.name?.trim() || customer.billingRuleName || null,
      currency: latestSubscription.plan.currency ?? 'MMK',
      monthlyFee: cycleFee.toFixed(2),
      installationFee: installationFee.toFixed(2),
      additionalFees: additionalFees.toFixed(2),
      discountAmount: '0',
      subtotalAmount: subtotalAmount.toFixed(2),
      plusAmount: '0',
      minusAmount: '0',
      totalAmount: subtotalAmount.toFixed(2),
      status: 'unpaid',
      collectionStatus: 'idle',
      collectionEvents: [],
      collectionUpdatedAt: null,
      dueDate: this.toDateString(this.addDays(periodStartDate, resolvedDueAfterDays)),
    });

    const savedInvoice = await this.billsRepository.save(invoice);

    return this.applyAutomaticAdjustmentsToInvoice(savedInvoice.id);
  }


  async applyAutomaticAdjustmentsToInvoice(invoiceId: string) {
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

    const autoAdjustments = [...globalDtos, ...recurringDtos].sort(
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
      this.toNumber(invoice.additionalFees);

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
    invoiceNo: string | null | undefined,
    referenceDate: Date = new Date(),
    excludeInvoiceId?: string,
  ): Promise<string> {
    const baseCore = this.getReceiptCoreFromInvoiceNo(invoiceNo, referenceDate);
    const baseReceiptNo = `RC-${baseCore}`;

    let nextReceiptNo = baseReceiptNo;
    let suffix = 1;

    while (true) {
      const builder = this.billsRepository
        .createQueryBuilder('bill')
        .where('UPPER(bill.receiptNo) = :receiptNo', {
          receiptNo: nextReceiptNo.toUpperCase(),
        });

      if (excludeInvoiceId) {
        builder.andWhere('bill.id != :excludeInvoiceId', { excludeInvoiceId });
      }

      const exists = (await builder.getCount()) > 0;
      if (!exists) {
        return nextReceiptNo;
      }

      suffix += 1;
      nextReceiptNo = `${baseReceiptNo}-${String(suffix).padStart(2, '0')}`;
    }
  }

  private getReceiptCoreFromInvoiceNo(
    invoiceNo: string | null | undefined,
    referenceDate: Date = new Date(),
  ): string {
    const rawInvoiceNo = String(invoiceNo ?? '')
      .trim()
      .toUpperCase();
    if (!rawInvoiceNo) {
      const month = String(referenceDate.getMonth() + 1).padStart(2, '0');
      const year = String(referenceDate.getFullYear()).slice(-2);
      const stamp = String(referenceDate.getTime()).slice(-4);
      return `${month}${year}${stamp}`;
    }

    if (rawInvoiceNo.startsWith('INV-')) {
      return rawInvoiceNo.slice(4);
    }

    if (rawInvoiceNo.startsWith('INV')) {
      return rawInvoiceNo.slice(3).replace(/^-+/, '');
    }

    return rawInvoiceNo;
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
      const targetDay = Number.parseInt(String(fixedStartDay ?? ''), 10);
      const day = Number.isFinite(targetDay) && targetDay >= 1 && targetDay <= 31 ? targetDay : 1;
      const anchorStart = new Date(
        fallbackDate.getFullYear(),
        fallbackDate.getMonth(),
        fallbackDate.getDate(),
      );
      const nextCycleStart = this.getNextFixedCycleStartDate(anchorStart, day);
      const fixedFirstEnd = this.addDays(nextCycleStart, -1);
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
    return value.toISOString().slice(0, 10);
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

  private async activateCustomerAndUser(customer?: Customer | null) {
    if (!customer) return;

    if (customer.status !== CustomerStatus.ENABLE) {
      customer.status = CustomerStatus.ENABLE;
      await this.customersRepository.save(customer);
    }

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

  private toNumber(
value: string | number | null | undefined): number {
    if (value === null || value === undefined || value === '') {
      return 0;
    }

    const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private roundTo2(value: number): number {
    return Number.parseFloat(value.toFixed(2));
  }
}
