import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ description: 'Email, username, or phone number', example: 'admin@example.com' })
  @IsString()
  identifier: string;

  @ApiProperty({ description: 'Current password', minLength: 6 })
  @IsString()
  @MinLength(6)
  currentPassword: string;

  @ApiProperty({ description: 'New password', minLength: 6 })
  @IsString()
  @MinLength(6)
  newPassword: string;
}
