import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BillingCycle } from '../common/enums/billing-cycle.enum';
import { CustomerStatus } from '../common/enums/customer-status.enum';
import { CustomerType } from '../common/enums/customer-type.enum';
import { IpType } from '../common/enums/ip-type.enum';
import { UserStatus } from '../common/enums/user-status.enum';
import { Bill } from '../billing/entities/bill.entity';
import { BillingService } from '../billing/billing.service';
import { Plan } from '../plans/entities/plan.entity';
import { SubscriptionNetwork } from '../subscription-networks/entities/subscription-network.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { User } from '../users/entities/user.entity';
import { CreateCustomerDetailsDto } from './dto/create-customer-details.dto';
import { CustomerIntakeDto, FirstInvoiceMode } from './dto/customer-intake.dto';
import { UpdateCustomerDetailsDto, UpdateCustomerServicesDto } from './dto/update-customer-details.dto';
import { Customer } from './entities/customer.entity';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private readonly customersRepository: Repository<Customer>,
    @InjectRepository(Plan)
    private readonly plansRepository: Repository<Plan>,
    @InjectRepository(Subscription)
    private readonly subscriptionsRepository: Repository<Subscription>,
    @InjectRepository(SubscriptionNetwork)
    private readonly networksRepository: Repository<SubscriptionNetwork>,
    @InjectRepository(Bill)
    private readonly billsRepository: Repository<Bill>,
    private readonly billingService: BillingService,
  ) {}

  async createCustomer(payload: CreateCustomerDetailsDto): Promise<Customer> {
    await this.assertCustomerCodeUnique(payload.customerCode);
    this.validateCustomerTypeRules(payload.customerType, payload);

    const { collectionFee, ...restPayload } = payload;
    const normalizedCollectionFee =
      collectionFee === undefined
        ? undefined
        : this.roundTo2(Math.max(0, this.toNumber(collectionFee))).toFixed(2);

    const customer = this.customersRepository.create({
      ...restPayload,
      status: payload.status ?? undefined,
      collectionFee: normalizedCollectionFee,
    });

    return this.customersRepository.save(customer);
  }

  async updateCustomer(
    customerId: string,
    payload: UpdateCustomerDetailsDto,
  ): Promise<Customer> {
    const customer = await this.customersRepository.findOne({
      where: { id: customerId },
      relations: { user: true },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const { services, ...customerPayload } = payload;
    const normalizedCustomerPayload: Record<string, unknown> = {
      ...customerPayload,
    };

    if (normalizedCustomerPayload.collectionFee !== undefined) {
      normalizedCustomerPayload.collectionFee = this.roundTo2(
        Math.max(0, this.toNumber(normalizedCustomerPayload.collectionFee as string | number)),
      ).toFixed(2);
    }

    if (normalizedCustomerPayload.collectionServiceEnabled === false) {
      normalizedCustomerPayload.collectionFee = '0.00';
      normalizedCustomerPayload.collectorCode = null;
    }
    const nextPrimaryPhone =
      normalizedCustomerPayload.primaryPhone !== undefined
        ? String(normalizedCustomerPayload.primaryPhone).trim()
        : '';
    const nextContactEmail =
      normalizedCustomerPayload.contactEmail !== undefined
        ? String(normalizedCustomerPayload.contactEmail).trim().toLowerCase()
        : '';
    const hasPrimaryPhoneUpdate = nextPrimaryPhone.length > 0;
    const hasContactEmailUpdate = nextContactEmail.length > 0;
    const usersRepository = this.customersRepository.manager.getRepository(User);

    const merged = { ...customer, ...normalizedCustomerPayload };
    if (
      normalizedCustomerPayload.customerCode &&
      normalizedCustomerPayload.customerCode !== customer.customerCode
    ) {
      await this.assertCustomerCodeUnique(
        String(normalizedCustomerPayload.customerCode),
        customerId,
      );
    }

    this.validateCustomerTypeRules(
      (merged.customerType as CustomerType) ?? customer.customerType,
      merged as unknown as Partial<CreateCustomerDetailsDto>,
    );

    if (customer.user) {
      if (hasPrimaryPhoneUpdate && nextPrimaryPhone !== customer.user.phone) {
        const existingPhoneUser = await usersRepository.findOne({
          where: { phone: nextPrimaryPhone },
        });
        if (existingPhoneUser && existingPhoneUser.id !== customer.user.id) {
          throw new BadRequestException('Phone already exists');
        }
      }

      if (hasContactEmailUpdate && nextContactEmail !== customer.user.email) {
        const existingEmailUser = await usersRepository.findOne({
          where: { email: nextContactEmail },
        });
        if (existingEmailUser && existingEmailUser.id !== customer.user.id) {
          throw new BadRequestException('Email already exists');
        }
      }
    }

    this.customersRepository.merge(customer, normalizedCustomerPayload as Partial<Customer>);
    const saved = await this.customersRepository.save(customer);

    const hasServicesPayload =
      !!services && Object.values(services).some((value) => value !== undefined);
    if (hasServicesPayload && services) {
      await this.upsertCustomerSubscription(saved, services);
    }

    if (normalizedCustomerPayload.status && customer.user) {
      customer.user.status =
        normalizedCustomerPayload.status === CustomerStatus.ENABLE
          ? UserStatus.ACTIVE
          : UserStatus.INACTIVE;
    }

    if (customer.user) {
      if (hasPrimaryPhoneUpdate) {
        customer.user.phone = nextPrimaryPhone;
      }
      if (hasContactEmailUpdate) {
        customer.user.email = nextContactEmail;
      }
      await this.customersRepository.manager.save(customer.user);
    }

    return saved;
  }

  async removeCustomerById(customerId: string): Promise<void> {
    await this.customersRepository.delete(customerId);
  }


  async getAllCustomers(): Promise<
    Array<{
      id: string;
      customerCode: string;
      customerType: CustomerType;
      status: CustomerStatus;
      collectorCode?: string | null;
      billingRuleId?: string | null;
      billingRuleName?: string | null;
      collectionServiceEnabled: boolean;
      collectionFee: string;
      companyName?: string | null;
      personalName?: string | null;
      primaryPhone: string;
      contactEmail?: string | null;
      installationAddress?: string | null;
      installationMapLink?: string | null;
      billingMapLink?: string | null;
      createdAt: Date;
      contactPerson?: {
        name: string;
        nrc: string;
      } | null;
      subscription?: {
        id: string;
        serviceType: string;
        serviceStartDate?: string | null;
        contractStartDate?: string | null;
        contractEndDate?: string | null;
        ipType: IpType;
        staticIpAddress?: string | null;
        plan?: {
          id: string;
          planCode: string;
          planName: string;
          monthlyFee: string;
          currency: string;
        } | null;
      } | null;
    }>
  > {
    const customers = await this.customersRepository.find({
      relations: {
        subscriptions: {
          plan: true,
        },
      },
      order: { createdAt: 'DESC' },
    });

    return customers.map((customer) => {
      const latestSubscription = customer.subscriptions?.length
        ? [...customer.subscriptions].sort(
            (a, b) =>
              (b.createdAt?.getTime?.() ?? 0) -
              (a.createdAt?.getTime?.() ?? 0),
          )[0]
        : null;

      return {
        id: customer.id,
        customerCode: customer.customerCode,
        customerType: customer.customerType,
        status: customer.status,
        collectorCode: customer.collectorCode ?? null,
        billingRuleId: customer.billingRuleId ?? null,
        billingRuleName: customer.billingRuleName ?? null,
        collectionServiceEnabled: customer.collectionServiceEnabled ?? true,
        collectionFee: customer.collectionFee ?? '0.00',
        companyName: customer.companyName ?? null,
        personalName: customer.personalName ?? null,
        primaryPhone: customer.primaryPhone,
        contactEmail: customer.contactEmail ?? null,
        installationAddress: customer.installationAddress ?? null,
        installationMapLink: customer.installationMapLink ?? null,
        billingMapLink: customer.billingMapLink ?? null,
        createdAt: customer.createdAt,
        contactPerson:
          customer.customerType === CustomerType.BUSINESS &&
          customer.authorizedContactPerson &&
          customer.contactNrc
            ? {
                name: customer.authorizedContactPerson,
                nrc: customer.contactNrc,
              }
            : null,
        subscription: latestSubscription
          ? {
            id: latestSubscription.id,
            serviceType: latestSubscription.serviceType,
            serviceStartDate: latestSubscription.serviceStartDate ?? null,
            contractStartDate: latestSubscription.contractStartDate ?? null,
            contractEndDate: latestSubscription.contractEndDate ?? null,
            ipType: latestSubscription.ipType,
            staticIpAddress: latestSubscription.staticIpAddress ?? null,
              plan: latestSubscription.plan
                ? {
                    id: latestSubscription.plan.id,
                    planCode: latestSubscription.plan.planCode,
                    planName: latestSubscription.plan.planName,
                    monthlyFee: latestSubscription.plan.monthlyFee,
                    currency: latestSubscription.plan.currency,
                  }
                : null,
            }
          : null,
      };
    });
  }

  async generateCustomerCode(): Promise<string> {
    const latest = await this.customersRepository
      .createQueryBuilder('customer')
      .select('customer.customerCode', 'customerCode')
      .where('customer.customerCode LIKE :prefix', { prefix: 'cust%' })
      .orderBy('customer.customerCode', 'DESC')
      .limit(1)
      .getRawOne<{ customerCode?: string }>();

    const lastCode = latest?.customerCode;
    const lastNumber = lastCode
      ? Number.parseInt(lastCode.replace('cust', ''), 10)
      : 0;
    const nextNumber = Number.isNaN(lastNumber) ? 1 : lastNumber + 1;

    return `cust${nextNumber.toString().padStart(6, '0')}`;
  }



  async generateInvoiceNo(referenceDate: Date = new Date()): Promise<string> {
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


  async createCustomerFromIntake(
    dto: CustomerIntakeDto,
    customerCode: string,
  ): Promise<Customer> {
    this.validateCustomerTypeRules(dto.customerType, {
      personalName: dto.personalInformation?.name ?? null,
      personalNrc: dto.personalInformation?.nrc ?? null,
      companyName: dto.businessInformation?.companyName ?? null,
      authorizedContactPerson: dto.businessInformation?.authorizedContactPerson ?? null,
      contactNrc: dto.businessInformation?.contactNrc ?? null,
    } as CreateCustomerDetailsDto);

    const collectionServiceEnabled = this.normalizeCollectionService(
      dto.billingInformation?.collectionService,
    );
    const collectionFee = collectionServiceEnabled
      ? this.roundTo2(this.toNumber(dto.billingInformation?.collectionFee ?? 0))
      : 0;

    const customer = this.customersRepository.create({
      customerCode,
      customerType: dto.customerType,
      status: CustomerStatus.PENDING,
      primaryPhone: dto.contactInformation.primaryPhone,
      secondaryPhone: dto.contactInformation.secondaryPhone ?? null,
      contactEmail: dto.contactInformation.email ?? null,
      installationAddress: dto.addressInformation?.installation ?? null,
      billingAddress: dto.addressInformation?.billing ?? null,
      installationMapLink: dto.addressInformation?.installationMapLink ?? null,
      billingMapLink: dto.addressInformation?.billingMapLink ?? null,
      personalName: dto.personalInformation?.name ?? null,
      personalNrc: dto.personalInformation?.nrc ?? null,
      companyName: dto.businessInformation?.companyName ?? null,
      businessRegistrationNumber:
        dto.businessInformation?.businessRegistrationNumber ?? null,
      taxIdentificationNumber:
        dto.businessInformation?.taxIdentificationNumber ?? null,
      authorizedContactPerson:
        dto.businessInformation?.authorizedContactPerson ?? null,
      contactNrc: dto.businessInformation?.contactNrc ?? null,
      defaultInstallationFee: this.roundTo2(
        this.toNumber(dto.billingInformation?.installationFee ?? 0),
      ).toFixed(2),
      defaultAdditionalFees: this.roundTo2(
        this.toNumber(dto.billingInformation?.additionalFees ?? 0),
      ).toFixed(2),
      collectionServiceEnabled,
      collectionFee: collectionFee.toFixed(2),
    });

    return this.customersRepository.save(customer);
  }

  async createPlanFromIntake(dto: CustomerIntakeDto): Promise<Plan> {
    const planCode = dto.services.serviceId;
    const existing = await this.plansRepository.findOne({
      where: { planCode },
    });

    if (existing) {
      return existing;
    }

    const plan = this.plansRepository.create({
      planCode,
      planName: dto.services.packageName ?? planCode,
      bandwidthPlan: dto.services.bandwidthPlan ?? null,
      monthlyFee: dto.billingInformation?.monthlySubscriptionFee?.toString() ?? '0',
      currency: dto.billingInformation?.currency ?? 'MMK',
      isActive: true,
    });

    return this.plansRepository.save(plan);
  }

  async createSubscriptionFromIntake(
    customer: Customer,
    plan: Plan,
    dto: CustomerIntakeDto,
  ): Promise<Subscription> {
    if (dto.services.ipType === IpType.STATIC && !dto.services.staticIpAddress) {
      throw new BadRequestException('Static IP address is required');
    }

    const subscription = this.subscriptionsRepository.create({
      customer,
      plan,
      serviceType: dto.services.serviceType,
      serviceStartDate: dto.services.serviceStartDate ?? null,
      contractStartDate: dto.services.contractStartDate ?? null,
      contractEndDate: dto.services.contractEndDate ?? null,
      installationDate: dto.services.installationDate ?? null,
      ipType: dto.services.ipType ?? IpType.DYNAMIC,
      staticIpAddress: dto.services.staticIpAddress ?? null,
    });

    return this.subscriptionsRepository.save(subscription);
  }

  async createNetworkFromIntake(
    subscription: Subscription,
    dto: CustomerIntakeDto,
  ): Promise<SubscriptionNetwork | null> {
    if (!dto.networkTechnical) {
      return null;
    }

    const network = this.networksRepository.create({
      subscription,
      routerId: dto.networkTechnical.routerId ?? null,
      macAddress: dto.networkTechnical.macAddress ?? null,
      onuSerial: dto.networkTechnical.onuSerial ?? null,
      vlanPort: dto.networkTechnical.vlanPort ?? null,
      networkZone: dto.networkTechnical.networkZone ?? null,
    });

    return this.networksRepository.save(network);
  }

  async createBillFromIntake(
    customer: Customer,
    subscription: Subscription,
    dto: CustomerIntakeDto,
  ): Promise<Bill | null> {
    if (!dto.billingInformation) {
      return null;
    }

    const monthlyFeeBase = dto.billingInformation.monthlySubscriptionFee ?? 0;
    const installationFee = dto.billingInformation.installationFee ?? 0;
    const baseAdditionalFees = dto.billingInformation.additionalFees ?? 0;
    const collectionServiceEnabled = this.normalizeCollectionService(
      dto.billingInformation.collectionService,
    );
    const collectionFee = collectionServiceEnabled
      ? this.toNumber(dto.billingInformation.collectionFee ?? 0)
      : 0;
    const additionalFees = baseAdditionalFees + collectionFee;
    const discountAmount = dto.billingInformation.discountAmount ?? 0;
    const rawCustomMonths = Number.parseInt(
      String(dto.billingInformation.customBillingMonths ?? ''),
      10,
    );
    const customBillingMonths =
      Number.isFinite(rawCustomMonths) && rawCustomMonths > 0
        ? rawCustomMonths
        : null;

    const today = new Date();
    const fallbackDate = today.toISOString().slice(0, 10);
    const baseDate = this.parseDateOnly(
      dto.services.serviceStartDate ?? dto.services.installationDate ?? fallbackDate,
    );

    const firstInvoiceMode =
      dto.billingInformation.firstInvoiceMode ?? FirstInvoiceMode.ANNIVERSARY;

    let billingPeriodStartDate = new Date(baseDate);
    let billingPeriodEndDate: Date;
    let dueDateValue: Date;
    let monthlyFee = monthlyFeeBase;

    if (firstInvoiceMode === FirstInvoiceMode.FIXED) {
      const fixedStartDay = dto.billingInformation.fixedStartDay ?? 1;
      const fixedDueDay =
        dto.billingInformation.fixedDueDay ?? dto.billingInformation.billingDay ?? 15;

      const nextCycleStart = this.getNextFixedCycleStartDate(baseDate, fixedStartDay);
      billingPeriodEndDate = this.addDays(nextCycleStart, -1);
      dueDateValue = this.getNextDayOccurrence(baseDate, fixedDueDay);

      const proratedDays = this.daysBetweenInclusive(
        billingPeriodStartDate,
        billingPeriodEndDate,
      );
      const monthDays = this.daysInMonth(billingPeriodStartDate);
      monthlyFee = this.roundTo2((monthlyFeeBase * proratedDays) / monthDays);
    } else {
      const billingPeriodStart = dto.services.serviceStartDate ?? this.toDateString(baseDate);
      const billingPeriodEnd = dto.services.contractStartDate ?? billingPeriodStart;
      billingPeriodStartDate = this.parseDateOnly(billingPeriodStart);
      billingPeriodEndDate = this.parseDateOnly(billingPeriodEnd);
      dueDateValue = this.addDays(baseDate, 7);
    }

    const subtotalAmount = monthlyFee + installationFee + additionalFees;
    const plusAmount = 0;
    const minusAmount = discountAmount;
    const totalAmount = subtotalAmount + plusAmount - minusAmount;

    if (totalAmount < 0) {
      throw new BadRequestException('Total amount cannot be negative');
    }

    const invoiceDate = this.toDateString(baseDate);
    const billingPeriodStart = this.toDateString(billingPeriodStartDate);
    const billingPeriodEnd = this.toDateString(billingPeriodEndDate);

    const bill = this.billsRepository.create({
      customer,
      subscription,
      invoiceNo: await this.generateInvoiceNo(),
      invoiceType: 'auto',
      invoiceDate,
      billingPeriodFrom: billingPeriodStart,
      billingPeriodTo: billingPeriodEnd,
      billingCycle: dto.billingInformation.billingCycle ?? BillingCycle.MONTHLY,
      customBillingMonths:
        dto.billingInformation.billingCycle === BillingCycle.CUSTOM
          ? customBillingMonths
          : null,
      billingMonth: billingPeriodStart.slice(0, 7),
      billingDay:
        dto.billingInformation.billingDay ??
        (firstInvoiceMode === FirstInvoiceMode.FIXED
          ? dto.billingInformation.fixedDueDay ?? 15
          : billingPeriodStartDate.getDate()),
      dueAfterDays: 7,
      currency: dto.billingInformation.currency ?? 'MMK',
      monthlyFee: monthlyFee.toFixed(2),
      installationFee: installationFee.toFixed(2),
      additionalFees: additionalFees.toFixed(2),
      discountAmount: discountAmount.toFixed(2),
      subtotalAmount: subtotalAmount.toFixed(2),
      plusAmount: plusAmount.toFixed(2),
      minusAmount: minusAmount.toFixed(2),
      totalAmount: totalAmount.toFixed(2),
      status: 'unpaid',
      dueDate: this.toDateString(dueDateValue),
    });

    const savedBill = await this.billsRepository.save(bill);

    await this.billingService.applyAutomaticAdjustmentsToInvoice(savedBill.id);

    return savedBill;
  }


  private async upsertCustomerSubscription(
    customer: Customer,
    services: UpdateCustomerServicesDto,
  ) {
    const requestedPlanCode = this.normalizeOptionalString(
      services.serviceId ?? services.planCode,
    );

    let latestSubscription = await this.subscriptionsRepository.findOne({
      where: { customer: { id: customer.id } },
      relations: { plan: true },
      order: { createdAt: 'DESC' },
    });

    let targetPlan = latestSubscription?.plan ?? null;

    if (requestedPlanCode) {
      targetPlan = await this.plansRepository.findOne({
        where: { planCode: requestedPlanCode },
      });

      if (!targetPlan) {
        throw new BadRequestException(
          `Plan not found for code: ${requestedPlanCode}`,
        );
      }
    }

    if (!latestSubscription) {
      if (!targetPlan) {
        throw new BadRequestException(
          'serviceId or planCode is required to create a subscription',
        );
      }

      const serviceType = this.normalizeOptionalString(services.serviceType);
      if (!serviceType) {
        throw new BadRequestException(
          'serviceType is required to create a subscription',
        );
      }

      latestSubscription = this.subscriptionsRepository.create({
        customer,
        plan: targetPlan,
        serviceType,
        serviceStartDate: services.serviceStartDate ?? null,
        contractStartDate: services.contractStartDate ?? null,
        contractEndDate: services.contractEndDate ?? null,
        installationDate: services.installationDate ?? null,
        ipType: services.ipType ?? IpType.DYNAMIC,
        staticIpAddress:
          this.normalizeOptionalString(services.staticIpAddress) ?? null,
      });
    } else {
      if (targetPlan) {
        latestSubscription.plan = targetPlan;
      }

      const serviceType = this.normalizeOptionalString(services.serviceType);
      if (serviceType) {
        latestSubscription.serviceType = serviceType;
      }

      if (services.serviceStartDate !== undefined) {
        latestSubscription.serviceStartDate = services.serviceStartDate ?? null;
      }
      if (services.contractStartDate !== undefined) {
        latestSubscription.contractStartDate =
          services.contractStartDate ?? null;
      }
      if (services.contractEndDate !== undefined) {
        latestSubscription.contractEndDate = services.contractEndDate ?? null;
      }
      if (services.installationDate !== undefined) {
        latestSubscription.installationDate = services.installationDate ?? null;
      }
      if (services.ipType !== undefined) {
        latestSubscription.ipType = services.ipType;
      }
      if (services.staticIpAddress !== undefined) {
        latestSubscription.staticIpAddress =
          this.normalizeOptionalString(services.staticIpAddress) ?? null;
      }
    }

    if (
      latestSubscription.ipType === IpType.STATIC &&
      !latestSubscription.staticIpAddress
    ) {
      throw new BadRequestException('Static IP address is required');
    }

    await this.subscriptionsRepository.save(latestSubscription);
  }

  private normalizeOptionalString(value?: string | null): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }


  private normalizeCollectionService(value: unknown): boolean {
    if (typeof value === 'boolean') {
      return value;
    }

    const normalized = String(value ?? '')
      .trim()
      .toLowerCase();

    if (
      ['no', 'false', '0', 'disable', 'disabled', 'off'].includes(normalized)
    ) {
      return false;
    }

    if (
      ['yes', 'true', '1', 'enable', 'enabled', 'active', 'on'].includes(
        normalized,
      )
    ) {
      return true;
    }

    return true;
  }

  private toDateString(value: Date): string {
    return value.toISOString().slice(0, 10);
  }

  private addDays(value: Date, days: number): Date {
    const output = new Date(value);
    output.setDate(output.getDate() + days);
    return output;
  }

  private roundTo2(value: number): number {
    return Number.parseFloat(value.toFixed(2));
  }

  private toNumber(value: string | number | null | undefined): number {
    if (value === null || value === undefined || value === '') {
      return 0;
    }

    const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private parseDateOnly(value: string): Date {
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
      return new Date();
    }

    return new Date(year, month - 1, day);
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

  private daysInMonth(date: Date): number {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  }

  private daysBetweenInclusive(start: Date, end: Date): number {
    const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
    const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
    const diff = Math.floor((endUtc - startUtc) / (1000 * 60 * 60 * 24)) + 1;
    return diff > 0 ? diff : 1;
  }

  private async assertCustomerCodeUnique(
    customerCode: string,
    ignoreId?: string,
  ) {
    const existing = await this.customersRepository.findOne({
      where: { customerCode },
    });

    if (existing && existing.id !== ignoreId) {
      throw new BadRequestException('Customer code already exists');
    }
  }

  private validateCustomerTypeRules(
    type: CustomerType,
    payload: Partial<CreateCustomerDetailsDto> | Record<string, unknown>,
  ) {
    if (type === CustomerType.INDIVIDUAL) {
      if (!payload.personalName || !payload.personalNrc) {
        throw new BadRequestException(
          'Personal name and NRC are required for individual customers',
        );
      }
      if (payload.companyName) {
        throw new BadRequestException(
          'Company name must be empty for individual customers',
        );
      }
    }

    if (type === CustomerType.BUSINESS) {
      if (
        !payload.companyName ||
        !payload.authorizedContactPerson ||
        !payload.contactNrc
      ) {
        throw new BadRequestException(
          'Company name, authorized contact person, and contact NRC are required for business customers',
        );
      }
    }
  }
}
