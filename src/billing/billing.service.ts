import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserStatus } from '../common/enums/user-status.enum';
import { CustomerStatus } from '../common/enums/customer-status.enum';
import { BillingCycle } from '../common/enums/billing-cycle.enum';
import { Customer } from '../customers/entities/customer.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { User } from '../users/entities/user.entity';
import { MarkInvoicePaidDto } from './dto/mark-invoice-paid.dto';
import {
  InvoiceAdjustmentInputDto,
  UpdateInvoiceAdjustmentsDto,
} from './dto/update-invoice-adjustments.dto';
import {
  AdjustmentType,
  AdjustmentValueType,
  BillAdjustment,
} from './entities/bill-adjustment.entity';
import { Bill } from './entities/bill.entity';
import { CustomerRecurringAdjustment } from './entities/customer-recurring-adjustment.entity';

@Injectable()
export class BillingService {
  constructor(
    @InjectRepository(Bill)
    private readonly billsRepository: Repository<Bill>,
    @InjectRepository(BillAdjustment)
    private readonly billAdjustmentsRepository: Repository<BillAdjustment>,
    @InjectRepository(CustomerRecurringAdjustment)
    private readonly recurringAdjustmentsRepository: Repository<CustomerRecurringAdjustment>,
    @InjectRepository(Customer)
    private readonly customersRepository: Repository<Customer>,
    @InjectRepository(Subscription)
    private readonly subscriptionsRepository: Repository<Subscription>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

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
    invoice.paymentMethod = dto.paymentMethod?.trim() || invoice.paymentMethod || null;
    invoice.receiptNo = dto.receiptNo?.trim() || invoice.receiptNo || null;

    await this.billsRepository.save(invoice);

    const customer = invoice.customer;
    if (customer && customer.status !== CustomerStatus.ENABLE) {
      customer.status = CustomerStatus.ENABLE;
      await this.customersRepository.save(customer);
    }

    if (customer) {
      const user = await this.usersRepository.findOne({
        where: { customer: { id: customer.id } },
      });

      if (user && user.status !== UserStatus.ACTIVE) {
        user.status = UserStatus.ACTIVE;
        await this.usersRepository.save(user);
      }
    }

    return this.getInvoiceById(invoice.id);
  }

  async generateInvoiceForCustomer(customerId: string) {
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
      where: { customer: { id: customerId } },
      order: { issuedAt: 'DESC' },
    });

    const invoiceDate = new Date();
    const invoiceDateText = this.toDateString(invoiceDate);
    const billingCycle = latestInvoice?.billingCycle ?? BillingCycle.MONTHLY;
    const billingDay = latestInvoice?.billingDay ?? invoiceDate.getDate();
    const period = this.getBillingPeriod(invoiceDate, billingCycle);

    const monthlyFee = this.toNumber(latestSubscription.plan.monthlyFee);

    const invoice = this.billsRepository.create({
      customer,
      subscription: latestSubscription,
      invoiceNo: await this.generateInvoiceNo(),
      invoiceType: 'auto',
      invoiceDate: invoiceDateText,
      billingPeriodFrom: period.from,
      billingPeriodTo: period.to,
      billingCycle,
      billingMonth: invoiceDateText.slice(0, 7),
      billingDay,
      currency: latestSubscription.plan.currency ?? 'MMK',
      monthlyFee: monthlyFee.toFixed(2),
      installationFee: '0',
      additionalFees: '0',
      discountAmount: '0',
      subtotalAmount: monthlyFee.toFixed(2),
      plusAmount: '0',
      minusAmount: '0',
      totalAmount: monthlyFee.toFixed(2),
      status: 'unpaid',
      dueDate: this.toDateString(this.addDays(invoiceDate, 7)),
    });

    const savedInvoice = await this.billsRepository.save(invoice);

    const recurringAdjustments = await this.recurringAdjustmentsRepository.find({
      where: {
        customer: { id: customerId },
        isActive: true,
      },
      order: {
        sortOrder: 'ASC',
        createdAt: 'ASC',
      },
    });

    if (recurringAdjustments.length > 0) {
      const dtoAdjustments: InvoiceAdjustmentInputDto[] = recurringAdjustments.map(
        (adjustment, index) => ({
          description: adjustment.description,
          type: adjustment.type,
          valueType: adjustment.valueType,
          value: this.toNumber(adjustment.value),
          rememberForNext: true,
          sortOrder: adjustment.sortOrder ?? index,
        }),
      );

      await this.applyAdjustmentsToInvoice(savedInvoice, dtoAdjustments, false);
    }

    return this.getInvoiceById(savedInvoice.id);
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

  private async generateInvoiceNo(): Promise<string> {
    const latest = await this.billsRepository
      .createQueryBuilder('bill')
      .select('bill.invoiceNo', 'invoiceNo')
      .where('bill.invoiceNo LIKE :prefix', { prefix: 'INV-%' })
      .orderBy('bill.invoiceNo', 'DESC')
      .limit(1)
      .getRawOne<{ invoiceNo?: string }>();

    const lastNumber = latest?.invoiceNo
      ? Number.parseInt(latest.invoiceNo.replace('INV-', ''), 10)
      : 0;
    const nextNumber = Number.isNaN(lastNumber) ? 1 : lastNumber + 1;

    return `INV-${nextNumber.toString().padStart(6, '0')}`;
  }

  private getBillingPeriod(date: Date, cycle: BillingCycle) {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);

    let cycleMonths = 1;
    if (cycle === BillingCycle.QUARTERLY) {
      cycleMonths = 3;
    } else if (cycle === BillingCycle.YEARLY) {
      cycleMonths = 12;
    }

    const end = new Date(start.getFullYear(), start.getMonth() + cycleMonths, 0);

    return {
      from: this.toDateString(start),
      to: this.toDateString(end),
    };
  }

  private toDateString(value: Date): string {
    return value.toISOString().slice(0, 10);
  }

  private addDays(value: Date, days: number): Date {
    const output = new Date(value);
    output.setDate(output.getDate() + days);
    return output;
  }

  private toNumber(value: string | number | null | undefined): number {
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
