import { Injectable } from '@nestjs/common';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserStatus } from '../common/enums/user-status.enum';
import { User } from '../users/entities/user.entity';
import { CollectorIntakeDto } from './dto/collector-intake.dto';
import { UpdateCollectorDto } from './dto/update-collector.dto';
import { UpsertCollectorProfileDto } from './dto/upsert-collector-profile.dto';
import { CollectorProfile } from './entities/collector-profile.entity';

@Injectable()
export class CollectorsService {
  constructor(
    @InjectRepository(CollectorProfile)
    private readonly collectorsRepository: Repository<CollectorProfile>,
  ) {}

  async upsertProfile(
    user: User,
    payload: UpsertCollectorProfileDto,
  ): Promise<CollectorProfile> {
    let profile = await this.collectorsRepository.findOne({
      where: { user: { id: user.id } },
      relations: { user: true },
    });

    if (!profile) {
      profile = this.collectorsRepository.create({
        ...payload,
        user,
      });
    } else {
      this.collectorsRepository.merge(profile, payload);
    }

    return this.collectorsRepository.save(profile);
  }

  async generateCollectorCode(): Promise<string> {
    const collectors = await this.collectorsRepository
      .createQueryBuilder('collector')
      .select('collector.collectorCode', 'collectorCode')
      .getRawMany<{ collectorCode?: string }>();

    const maxNumber = collectors.reduce((highest, row) => {
      const code = String(row?.collectorCode ?? '').trim();
      if (!code) return highest;
      const digits = code.match(/(\d+)$/)?.[1];
      if (!digits) return highest;
      const parsed = Number.parseInt(digits, 10);
      return Number.isNaN(parsed) ? highest : Math.max(highest, parsed);
    }, 0);

    const nextNumber = maxNumber + 1;
    const padLength = Math.max(4, String(nextNumber).length);
    return `CO${nextNumber.toString().padStart(padLength, '0')}`;
  }

  async createCollectorProfileFromIntake(
    user: User,
    collectorCode: string,
    payload: CollectorIntakeDto,
  ): Promise<CollectorProfile> {
    const normalizedNrc = payload.nrc?.trim();
    if (normalizedNrc) {
      await this.assertCollectorNrcUnique(normalizedNrc);
    }

    const profile = this.collectorsRepository.create({
      collectorCode,
      address: payload.address,
      area: payload.area,
      nrc: normalizedNrc,
      language: payload.language?.trim().toLowerCase(),
      status: payload.status,
      user,
    });

    return this.collectorsRepository.save(profile);
  }

  async getAllCollectors(): Promise<CollectorProfile[]> {
    return this.collectorsRepository.find({
      relations: { user: true },
      order: { createdAt: 'DESC' },
    });
  }

  async updateCollector(
    collectorId: string,
    payload: UpdateCollectorDto,
  ): Promise<CollectorProfile> {
    const collector = await this.collectorsRepository.findOne({
      where: { id: collectorId },
      relations: { user: true },
    });

    if (!collector) {
      throw new NotFoundException('Collector not found');
    }

    if (payload.name && collector.user) {
      collector.user.name = payload.name.trim();
    }

    if (payload.phone && collector.user) {
      collector.user.phone = payload.phone.trim();
    }

    if (payload.email && collector.user) {
      collector.user.email = payload.email.trim().toLowerCase();
    }

    if (payload.area) {
      collector.area = payload.area.trim();
    }

    if (payload.status) {
      const normalizedStatus = payload.status.trim();
      collector.status = normalizedStatus;
      if (collector.user) {
        collector.user.status =
          normalizedStatus === 'enable'
            ? UserStatus.ACTIVE
            : UserStatus.INACTIVE;
      }
    }

    if (payload.nrc) {
      const normalizedNrc = payload.nrc.trim();
      await this.assertCollectorNrcUnique(normalizedNrc, collector.id);
      collector.nrc = normalizedNrc;
    }

    if (payload.language) {
      collector.language = payload.language.trim().toLowerCase();
    }

    if (payload.address) {
      collector.address = payload.address.trim();
    }

    if (collector.user) {
      await this.collectorsRepository.manager.save(collector.user);
    }

    return this.collectorsRepository.save(collector);
  }

  private async assertCollectorNrcUnique(nrc: string, ignoreCollectorId?: string) {
    const normalized = nrc.trim();
    if (!normalized) return;

    const existing = await this.collectorsRepository.findOne({
      where: { nrc: normalized },
      select: { id: true, nrc: true },
    });

    if (existing && existing.id !== ignoreCollectorId) {
      throw new BadRequestException('NRC already exists');
    }
  }
}
