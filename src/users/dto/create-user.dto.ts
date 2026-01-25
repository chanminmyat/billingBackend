import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { UserRole } from '../../common/enums/user-role.enum';
import { CreateAccountBaseDto } from './create-account-base.dto';

export class CreateUserDto extends CreateAccountBaseDto {
  @ApiProperty({ enum: UserRole })
  @IsEnum(UserRole)
  role: UserRole;
}
