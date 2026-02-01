import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BillingCycle } from '../common/enums/billing-cycle.enum';
import { CustomerStatus } from '../common/enums/customer-status.enum';
import { CustomerType } from '../common/enums/customer-type.enum';
import { IpType } from '../common/enums/ip-type.enum';
import { UserStatus } from '../common/enums/user-status.enum';
import { Bill } from '../billing/entities/bill.entity';
import { Plan } from '../plans/entities/plan.entity';
import { SubscriptionNetwork } from '../subscription-networks/entities/subscription-network.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { CreateCustomerDetailsDto } from './dto/create-customer-details.dto';
import { CustomerIntakeDto } from './dto/customer-intake.dto';
import { UpdateCustomerDetailsDto } from './dto/update-customer-details.dto';
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
  ) {}

  async createCustomer(payload: CreateCustomerDetailsDto): Promise<Customer> {
    await this.assertCustomerCodeUnique(payload.customerCode);
    this.validateCustomerTypeRules(payload.customerType, payload);

    const customer = this.customersRepository.create({
      ...payload,
      status: payload.status ?? undefined,
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

    const merged = { ...customer, ...payload };
    if (payload.customerCode && payload.customerCode !== customer.customerCode) {
      await this.assertCustomerCodeUnique(payload.customerCode, customerId);
    }

    this.validateCustomerTypeRules(merged.customerType, merged);

    this.customersRepository.merge(customer, payload);
    const saved = await this.customersRepository.save(customer);

    if (payload.status && customer.user) {
      customer.user.status =
        payload.status === CustomerStatus.ENABLE
          ? UserStatus.ACTIVE
          : UserStatus.INACTIVE;
      await this.customersRepository.manager.save(customer.user);
    }

    return saved;
  }

  async getAllCustomers(): Promise<
    Array<{
      id: string;
      customerCode: string;
      customerType: CustomerType;
      status: CustomerStatus;
      companyName?: string | null;
      personalName?: string | null;
      primaryPhone: string;
      contactEmail?: string | null;
      installationAddress?: string | null;
      createdAt: Date;
      contactPerson?: {
        name: string;
        nrc: string;
      } | null;
      subscription?: {
        id: string;
        serviceType: string;
        serviceStartDate?: string | null;
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
        companyName: customer.companyName ?? null,
        personalName: customer.personalName ?? null,
        primaryPhone: customer.primaryPhone,
        contactEmail: customer.contactEmail ?? null,
        installationAddress: customer.installationAddress ?? null,
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

    const customer = this.customersRepository.create({
      customerCode,
      customerType: dto.customerType,
      status: dto.userStatus ?? CustomerStatus.ENABLE,
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

    const monthlyFee = dto.billingInformation.monthlySubscriptionFee ?? 0;
    const installationFee = dto.billingInformation.installationFee ?? 0;
    const additionalFees = dto.billingInformation.additionalFees ?? 0;
    const discountAmount = dto.billingInformation.discountAmount ?? 0;

    const totalAmount =
      monthlyFee + installationFee + additionalFees - discountAmount;

    if (totalAmount < 0) {
      throw new BadRequestException('Total amount cannot be negative');
    }

    const bill = this.billsRepository.create({
      customer,
      subscription,
      billingCycle: dto.billingInformation.billingCycle ?? BillingCycle.MONTHLY,
      billingMonth: dto.services.serviceStartDate?.slice(0, 7) ?? 'unknown',
      billingDay: dto.billingInformation.billingDay ?? 1,
      currency: dto.billingInformation.currency ?? 'MMK',
      monthlyFee: monthlyFee.toString(),
      installationFee: installationFee.toString(),
      additionalFees: additionalFees.toString(),
      discountAmount: discountAmount.toString(),
      totalAmount: totalAmount.toString(),
      status: 'unpaid',
      dueDate: null,
    });

    return this.billsRepository.save(bill);
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
    payload: Partial<CreateCustomerDetailsDto>,
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
