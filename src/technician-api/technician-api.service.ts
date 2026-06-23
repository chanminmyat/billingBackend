import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { CustomerStatus } from '../common/enums/customer-status.enum';
import { Customer } from '../customers/entities/customer.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { CreateTechnicianApiKeyDto } from './dto/create-technician-api-key.dto';
import { UpdateTechnicianApiKeyDto } from './dto/update-technician-api-key.dto';
import { TechnicianApiKey } from './entities/technician-api-key.entity';

@Injectable()
export class TechnicianApiService {
  constructor(
    @InjectRepository(TechnicianApiKey)
    private readonly apiKeysRepository: Repository<TechnicianApiKey>,
    @InjectRepository(Customer)
    private readonly customersRepository: Repository<Customer>,
  ) {}

  async listKeys() {
    const keys = await this.apiKeysRepository.find({
      order: { createdAt: 'DESC' },
    });

    return keys.map((key) => ({
      id: key.id,
      name: key.name,
      description: key.description ?? null,
      keyPrefix: key.keyPrefix,
      maskedKey: `${key.keyPrefix}...${key.id.slice(0, 6)}`,
      isActive: key.isActive,
      allowedIps: key.allowedIps ?? [],
      lastUsedAt: key.lastUsedAt ?? null,
      createdAt: key.createdAt,
      updatedAt: key.updatedAt,
    }));
  }

  async createKey(dto: CreateTechnicianApiKeyDto) {
    const issued = this.issueRawKey();
    const entity = this.apiKeysRepository.create({
      name: dto.name.trim(),
      description: dto.description?.trim() || null,
      keyPrefix: issued.prefix,
      keyHash: issued.hash,
      isActive: true,
      allowedIps: this.normalizeAllowedIps(dto.allowedIps),
    });

    const saved = await this.apiKeysRepository.save(entity);

    return {
      id: saved.id,
      name: saved.name,
      description: saved.description ?? null,
      apiKey: issued.raw,
      keyPrefix: saved.keyPrefix,
      isActive: saved.isActive,
      allowedIps: saved.allowedIps ?? [],
      createdAt: saved.createdAt,
    };
  }

  async rotateKey(id: string) {
    const entity = await this.apiKeysRepository.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException('Technician API key not found');
    }

    const issued = this.issueRawKey();
    entity.keyPrefix = issued.prefix;
    entity.keyHash = issued.hash;
    entity.isActive = true;
    entity.lastUsedAt = null;
    await this.apiKeysRepository.save(entity);

    return {
      id: entity.id,
      name: entity.name,
      description: entity.description ?? null,
      apiKey: issued.raw,
      keyPrefix: entity.keyPrefix,
      isActive: entity.isActive,
      allowedIps: entity.allowedIps ?? [],
      updatedAt: entity.updatedAt,
    };
  }

  async updateKey(id: string, dto: UpdateTechnicianApiKeyDto) {
    const entity = await this.apiKeysRepository.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException('Technician API key not found');
    }

    if (dto.name !== undefined) {
      const nextName = dto.name.trim();
      if (!nextName) {
        throw new BadRequestException('Key name is required');
      }
      entity.name = nextName;
    }

    if (dto.description !== undefined) {
      entity.description = dto.description.trim() || null;
    }

    if (dto.allowedIps !== undefined) {
      entity.allowedIps = this.normalizeAllowedIps(dto.allowedIps);
    }

    await this.apiKeysRepository.save(entity);

    return {
      id: entity.id,
      name: entity.name,
      description: entity.description ?? null,
      isActive: entity.isActive,
      allowedIps: entity.allowedIps ?? [],
      updatedAt: entity.updatedAt,
    };
  }

  async updateKeyStatus(id: string, isActive: boolean) {
    const entity = await this.apiKeysRepository.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException('Technician API key not found');
    }

    entity.isActive = isActive;
    await this.apiKeysRepository.save(entity);

    return {
      id: entity.id,
      name: entity.name,
      isActive: entity.isActive,
      updatedAt: entity.updatedAt,
    };
  }

  async validateApiKey(rawApiKey?: string | null, callerIp?: string | null) {
    const sanitized = String(rawApiKey ?? '').trim();
    if (!sanitized) {
      throw new UnauthorizedException('Missing technician API key');
    }

    const entity = await this.apiKeysRepository.findOne({
      where: { keyHash: this.hashKey(sanitized) },
    });

    if (!entity || !entity.isActive) {
      throw new UnauthorizedException('Invalid technician API key');
    }

    const resolvedCallerIp = this.normalizeCallerIp(callerIp);
    const allowedIps = entity.allowedIps ?? [];
    if (allowedIps.length > 0 && (!resolvedCallerIp || !allowedIps.includes(resolvedCallerIp))) {
      throw new UnauthorizedException('Caller IP is not allowed for this technician API key');
    }

    entity.lastUsedAt = new Date();
    await this.apiKeysRepository.save(entity);
    return entity;
  }

  async getCustomerAccessFeed(updatedSince?: string | null) {
    const updatedSinceDate = this.parseUpdatedSince(updatedSince);
    const customers = await this.loadCustomersForFeed();

    return customers
      .filter((customer) => {
        if (!updatedSinceDate) return true;
        return customer.updatedAt instanceof Date && customer.updatedAt > updatedSinceDate;
      })
      .map((customer) => this.mapCustomerAccessRecord(customer));
  }

  async getCustomerAccessChanges(updatedSince?: string | null) {
    const updatedSinceDate = this.parseUpdatedSince(updatedSince);
    const items = await this.getCustomerAccessFeed(updatedSince);

    return {
      serverTime: new Date().toISOString(),
      updatedSinceApplied: updatedSinceDate ? updatedSinceDate.toISOString() : null,
      count: items.length,
      items,
    };
  }

  async getCustomerAccessByCode(customerCode: string) {
    const normalizedCode = customerCode.trim();
    if (!normalizedCode) {
      throw new BadRequestException('Customer code is required');
    }

    const customer = await this.customersRepository.findOne({
      where: { customerCode: normalizedCode },
      relations: {
        user: true,
        subscriptions: {
          plan: true,
          network: true,
        },
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return this.mapCustomerAccessRecord(customer);
  }

  private mapCustomerAccessRecord(customer: Customer) {
    const latestSubscription = this.pickLatestSubscription(customer.subscriptions ?? []);
    const network = latestSubscription?.network ?? null;
    const normalizedStatus = String(customer.status ?? '').trim().toLowerCase();
    const serviceAccessState = normalizedStatus === CustomerStatus.ENABLE ? 'active' : 'blocked';

    return {
      customerId: customer.id,
      customerCode: customer.customerCode,
      customerName: customer.personalName || customer.companyName || customer.authorizedContactPerson || null,
      customerStatus: customer.status,
      portalAccessStatus: customer.user?.status ?? null,
      serviceAccessState,
      shouldCutService: serviceAccessState === 'blocked',
      action: serviceAccessState === 'blocked' ? 'cut_service' : 'restore_service',
      contact: {
        primaryPhone: customer.primaryPhone,
        secondaryPhone: customer.secondaryPhone ?? null,
        email: customer.contactEmail ?? null,
      },
      addresses: {
        installationAddress: customer.installationAddress ?? null,
        billingAddress: customer.billingAddress ?? null,
      },
      network: {
        routerId: network?.routerId ?? null,
        macAddress: network?.macAddress ?? null,
        onuSerial: network?.onuSerial ?? null,
        vlanPort: network?.vlanPort ?? null,
        networkZone: network?.networkZone ?? null,
        ipType: latestSubscription?.ipType ?? null,
        staticIpAddress: latestSubscription?.staticIpAddress ?? null,
      },
      subscription: latestSubscription
        ? {
            id: latestSubscription.id,
            serviceType: latestSubscription.serviceType,
            serviceStartDate: latestSubscription.serviceStartDate ?? null,
            contractStartDate: latestSubscription.contractStartDate ?? null,
            contractEndDate: latestSubscription.contractEndDate ?? null,
            installationDate: latestSubscription.installationDate ?? null,
            plan: latestSubscription.plan
              ? {
                  id: latestSubscription.plan.id,
                  planCode: latestSubscription.plan.planCode,
                  planName: latestSubscription.plan.planName,
                  currency: latestSubscription.plan.currency,
                  monthlyFee: latestSubscription.plan.monthlyFee,
                }
              : null,
          }
        : null,
      updatedAt: customer.updatedAt,
    };
  }

  private async loadCustomersForFeed() {
    return this.customersRepository.find({
      relations: {
        user: true,
        subscriptions: {
          plan: true,
          network: true,
        },
      },
      order: { updatedAt: 'DESC' },
    });
  }

  private pickLatestSubscription(subscriptions: Subscription[]) {
    return subscriptions
      .slice()
      .sort((a, b) => {
        const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
        const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
        return bTime - aTime;
      })[0] ?? null;
  }

  private normalizeAllowedIps(rawAllowedIps?: string | null) {
    return Array.from(
      new Set(
        String(rawAllowedIps ?? '')
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    );
  }

  private normalizeCallerIp(rawIp?: string | null) {
    const value = String(rawIp ?? '').trim();
    if (!value) return null;
    const first = value.split(',')[0]?.trim() ?? '';
    if (!first) return null;
    return first.replace(/^::ffff:/i, '');
  }

  private parseUpdatedSince(updatedSince?: string | null) {
    const raw = String(updatedSince ?? '').trim();
    if (!raw) return null;
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('updatedSince must be a valid ISO date');
    }
    return parsed;
  }

  private issueRawKey() {
    const raw = `tka_${randomBytes(24).toString('hex')}`;
    return {
      raw,
      prefix: raw.slice(0, 12),
      hash: this.hashKey(raw),
    };
  }

  private hashKey(rawApiKey: string) {
    return createHash('sha256').update(rawApiKey).digest('hex');
  }
}
