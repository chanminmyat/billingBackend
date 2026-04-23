import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Bill } from '../billing/entities/bill.entity';
import { BillingRule } from '../billing/entities/billing-rule.entity';
import { Plan } from '../plans/entities/plan.entity';
import { SubscriptionNetwork } from '../subscription-networks/entities/subscription-network.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { Customer } from './entities/customer.entity';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Customer,
      Plan,
      Subscription,
      SubscriptionNetwork,
      Bill,
      BillingRule,
    ]),
    SubscriptionsModule,
    BillingModule,
  ],
  controllers: [CustomersController],
  providers: [CustomersService],
  exports: [CustomersService, TypeOrmModule],
})
export class CustomersModule {}
