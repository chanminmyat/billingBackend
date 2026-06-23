import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Customer } from '../customers/entities/customer.entity';
import { TechnicianApiKey } from './entities/technician-api-key.entity';
import { TechnicianApiController } from './technician-api.controller';
import { TechnicianApiService } from './technician-api.service';

@Module({
  imports: [TypeOrmModule.forFeature([TechnicianApiKey, Customer])],
  controllers: [TechnicianApiController],
  providers: [TechnicianApiService],
  exports: [TechnicianApiService],
})
export class TechnicianApiModule {}
