import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Password reset token received via email/SMS' })
  @IsString()
  token: string;

  @ApiProperty({ minLength: 6, example: 'NewPas' })
  @IsString()
  @MinLength(6)
  newPassword: string;
}
