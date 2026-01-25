import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CollectorsService } from './collectors.service';
import { CollectorProfile } from './entities/collector-profile.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CollectorProfile])],
  providers: [CollectorsService],
  exports: [CollectorsService, TypeOrmModule],
})
export class CollectorsModule {}
