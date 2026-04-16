import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Customer } from '../customers/entities/customer.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { User } from '../users/entities/user.entity';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { BillAdjustment } from './entities/bill-adjustment.entity';
import { Bill } from './entities/bill.entity';
import { BillingRule } from './entities/billing-rule.entity';
import { CustomerRecurringAdjustment } from './entities/customer-recurring-adjustment.entity';
import { GlobalInvoiceAdjustment } from './entities/global-invoice-adjustment.entity';
import { PaymentAccount } from './entities/payment-account.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Bill,
      BillAdjustment,
      BillingRule,
      CustomerRecurringAdjustment,
      GlobalInvoiceAdjustment,
      PaymentAccount,
      Customer,
      Subscription,
      User,
    ]),
  ],
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService, TypeOrmModule],
})
export class BillingModule {}
