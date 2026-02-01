import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CollectorsController } from './collectors.controller';
import { CollectorsService } from './collectors.service';
import { CollectorProfile } from './entities/collector-profile.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CollectorProfile])],
  controllers: [CollectorsController],
  providers: [CollectorsService],
  exports: [CollectorsService, TypeOrmModule],
})
export class CollectorsModule {}
