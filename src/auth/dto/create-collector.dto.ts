import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { CollectorIntakeDto } from '../../collectors/dto/collector-intake.dto';

export class CreateCollectorDto {
  @ApiProperty({ type: CollectorIntakeDto })
  @ValidateNested()
  @Type(() => CollectorIntakeDto)
  collector: CollectorIntakeDto;
}
