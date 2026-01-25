import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubscriptionNetwork } from './entities/subscription-network.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SubscriptionNetwork])],
  exports: [TypeOrmModule],
})
export class SubscriptionNetworksModule {}
