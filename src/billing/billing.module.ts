import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Bill } from './entities/bill.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Bill])],
  exports: [TypeOrmModule],
})
export class BillingModule {}
