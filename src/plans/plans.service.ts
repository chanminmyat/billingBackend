import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { Plan } from './entities/plan.entity';

@Injectable()
export class PlansService {
  constructor(
    @InjectRepository(Plan)
    private readonly plansRepository: Repository<Plan>,
  ) {}

  async createPlan(dto: CreatePlanDto): Promise<Plan> {
    const planCode = dto.planCode.trim();

    await this.assertPlanCodeUnique(planCode);

    const plan = this.plansRepository.create({
      planCode,
      planName: dto.planName.trim(),
      bandwidthPlan: dto.bandwidthPlan?.trim() ?? null,
      monthlyFee: (dto.monthlyFee ?? 0).toString(),
      currency: dto.currency?.trim() || 'MMK',
      isActive: dto.isActive ?? true,
    });

    return this.plansRepository.save(plan);
  }

  async updatePlan(planId: string, dto: UpdatePlanDto): Promise<Plan> {
    const plan = await this.plansRepository.findOne({ where: { id: planId } });

    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    if (dto.planCode !== undefined) {
      const planCode = dto.planCode.trim();
      if (planCode !== plan.planCode) {
        await this.assertPlanCodeUnique(planCode, plan.id);
        plan.planCode = planCode;
      }
    }

    if (dto.planName !== undefined) {
      plan.planName = dto.planName.trim();
    }

    if (dto.bandwidthPlan !== undefined) {
      const bandwidth = dto.bandwidthPlan.trim();
      plan.bandwidthPlan = bandwidth.length > 0 ? bandwidth : null;
    }

    if (dto.monthlyFee !== undefined) {
      plan.monthlyFee = dto.monthlyFee.toString();
    }

    if (dto.currency !== undefined) {
      const currency = dto.currency.trim();
      plan.currency = currency.length > 0 ? currency : 'MMK';
    }

    if (dto.isActive !== undefined) {
      plan.isActive = dto.isActive;
    }

    return this.plansRepository.save(plan);
  }


  async getAllPlans(): Promise<Plan[]> {
    return this.plansRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  private async assertPlanCodeUnique(planCode: string, ignoreId?: string) {
    const existing = await this.plansRepository.findOne({
      where: { planCode },
    });

    if (existing && existing.id !== ignoreId) {
      throw new BadRequestException('Plan code already exists');
    }
  }
}
