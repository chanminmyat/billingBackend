import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'Email, username, or phone number used to log in',
    example: 'collector@example.com',
  })
  @IsString()
  identifier: string;

  @ApiProperty({ minLength: 6, example: 'Passw0' })
  @IsString()
  @MinLength(6)
  password: string;
}
