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
    const latest = await this.collectorsRepository
      .createQueryBuilder('collector')
      .select('collector.collectorCode', 'collectorCode')
      .where('collector.collectorCode LIKE :prefix', { prefix: 'col%' })
      .orderBy('collector.collectorCode', 'DESC')
      .limit(1)
      .getRawOne<{ collectorCode?: string }>();

    const lastCode = latest?.collectorCode;
    const lastNumber = lastCode
      ? Number.parseInt(lastCode.replace('col', ''), 10)
      : 0;
    const nextNumber = Number.isNaN(lastNumber) ? 1 : lastNumber + 1;

    return `col${nextNumber.toString().padStart(6, '0')}`;
  }

  async createCollectorProfileFromIntake(
    user: User,
    collectorCode: string,
    payload: CollectorIntakeDto,
  ): Promise<CollectorProfile> {
    const profile = this.collectorsRepository.create({
      collectorCode,
      address: payload.address,
      area: payload.area,
      nrc: payload.nrc,
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
      collector.nrc = payload.nrc.trim();
    }

    if (payload.address) {
      collector.address = payload.address.trim();
    }

    if (collector.user) {
      await this.collectorsRepository.manager.save(collector.user);
    }

    return this.collectorsRepository.save(collector);
  }
}
