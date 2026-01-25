import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserStatus } from '../../common/enums/user-status.enum';

export class CreateAccountBaseDto {
  @ApiProperty({ example: 'Jane Doe', maxLength: 120 })
  @IsString()
  @MaxLength(120)
  name: string;

  @ApiProperty({ example: 'jane@example.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: '+959123456789', maxLength: 50 })
  @IsOptional()
  @Matches(/^[0-9+\-\s]*$/)
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional({ example: 'jane_doe', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  username?: string;

  @ApiPropertyOptional({ enum: UserStatus, default: UserStatus.ACTIVE })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiProperty({ minLength: 6, example: 'Passw0' })
  @IsString()
  @MinLength(6)
  password: string;
}
