import { PartialType } from '@nestjs/swagger';
import { CreateBillingRuleDto } from './create-billing-rule.dto';

export class UpdateBillingRuleDto extends PartialType(CreateBillingRuleDto) {}
