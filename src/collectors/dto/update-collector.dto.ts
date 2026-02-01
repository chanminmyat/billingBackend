import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateCollectorDto {
  @ApiPropertyOptional({ example: 'May Hanna' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: '0971234123' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'mayhanna@bill.com' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ example: 'Pauk' })
  @IsOptional()
  @IsString()
  area?: string;

  @ApiPropertyOptional({ example: 'enable' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: '7/KAWANA(T)123412' })
  @IsOptional()
  @IsString()
  nrc?: string;

  @ApiPropertyOptional({ example: '162, sanchaung street, Pauk, Pakokku' })
  @IsOptional()
  @IsString()
  address?: string;
}
