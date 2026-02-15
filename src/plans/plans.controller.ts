import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { PlansService } from './plans.service';

@ApiTags('Plans')
@Controller('plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  
  @Get()
  @ApiOperation({ summary: 'Get all plans' })
  getPlans() {
    return this.plansService.getAllPlans();
  }

@Post()
  @ApiOperation({ summary: 'Create a plan' })
  createPlan(@Body() dto: CreatePlanDto) {
    return this.plansService.createPlan(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a plan' })
  updatePlan(@Param('id') id: string, @Body() dto: UpdatePlanDto) {
    return this.plansService.updatePlan(id, dto);
  }
}
