import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { CreateAccountBaseDto } from '../../users/dto/create-account-base.dto';

export class CreateAdminDto {
  @ApiProperty({ type: CreateAccountBaseDto })
  @ValidateNested()
  @Type(() => CreateAccountBaseDto)
  admin: CreateAccountBaseDto;
}
