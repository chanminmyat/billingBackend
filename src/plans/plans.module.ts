import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlansController } from './plans.controller';
import { PlansService } from './plans.service';
import { Plan } from './entities/plan.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Plan])],
  controllers: [PlansController],
  providers: [PlansService],
  exports: [TypeOrmModule],
})
export class PlansModule {}
