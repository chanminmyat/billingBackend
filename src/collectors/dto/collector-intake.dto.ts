import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

export class CollectorIntakeDto {
  @ApiProperty({ example: 'May Hanna' })
  @IsString()
  name: string;

  @ApiProperty({ example: '0971234123' })
  @IsString()
  phone: string;

  @ApiProperty({ example: 'mayhanna@bill.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Pauk' })
  @IsString()
  area: string;

  @ApiProperty({ enum: ['enable', 'disable'], example: 'enable' })
  @IsString()
  status: string;

  @ApiProperty({ example: '7/KAWANA(T)123412' })
  @IsString()
  nrc: string;

  @ApiProperty({ example: 'burmese', required: false })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiProperty({ example: '162, sanchaung street, Pauk, Pakokku' })
  @IsString()
  address: string;
}
