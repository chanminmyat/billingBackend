import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
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
}
