import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsEmail, IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import { CustomerStatus } from '../../common/enums/customer-status.enum';
import { CustomerType } from '../../common/enums/customer-type.enum';

export class CreateCustomerDetailsDto {
  @ApiProperty({ example: 'C0001' })
  @IsString()
  customerCode: string;

  @ApiProperty({ enum: CustomerType })
  @IsEnum(CustomerType)
  customerType: CustomerType;

  @ApiPropertyOptional({ enum: CustomerStatus, default: CustomerStatus.ENABLE })
  @IsOptional()
  @IsEnum(CustomerStatus)
  status?: CustomerStatus;

  @ApiProperty({ example: '+959123456789' })
  @IsString()
  primaryPhone: string;

  @ApiPropertyOptional({ example: '+959987654321' })
  @IsOptional()
  @IsString()
  secondaryPhone?: string;

  @ApiPropertyOptional({ example: 'customer@business.com' })
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiPropertyOptional({ example: 'No. 12, Street 3, Yangon' })
  @IsOptional()
  @IsString()
  installationAddress?: string;

  @ApiPropertyOptional({ example: 'PO Box 123, Yangon' })
  @IsOptional()
  @IsString()
  billingAddress?: string;

  @ApiPropertyOptional({ example: 'https://maps.google.com/?q=16.8,96.1' })
  @IsOptional()
  @IsString()
  installationMapLink?: string;

  @ApiPropertyOptional({ example: 'https://maps.google.com/?q=16.8,96.1' })
  @IsOptional()
  @IsString()
  billingMapLink?: string;

  @ApiPropertyOptional({ example: 'col000001' })
  @IsOptional()
  @IsString()
  collectorCode?: string | null;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  collectionServiceEnabled?: boolean;

  @ApiPropertyOptional({ example: 1500 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  collectionFee?: number;

  @ApiPropertyOptional({ example: 'Mg Aung' })
  @ValidateIf((dto) => dto.customerType === CustomerType.INDIVIDUAL)
  @IsString()
  personalName?: string;

  @ApiPropertyOptional({ example: '12/ABC(N)123456' })
  @ValidateIf((dto) => dto.customerType === CustomerType.INDIVIDUAL)
  @IsString()
  personalNrc?: string;

  @ApiPropertyOptional({ example: 'ABC Co., Ltd.' })
  @ValidateIf((dto) => dto.customerType === CustomerType.BUSINESS)
  @IsString()
  companyName?: string;

  @ApiPropertyOptional({ example: 'BRN-001122' })
  @IsOptional()
  @IsString()
  businessRegistrationNumber?: string;

  @ApiPropertyOptional({ example: 'TIN-998877' })
  @IsOptional()
  @IsString()
  taxIdentificationNumber?: string;

  @ApiPropertyOptional({ example: 'U Win' })
  @ValidateIf((dto) => dto.customerType === CustomerType.BUSINESS)
  @IsString()
  authorizedContactPerson?: string;

  @ApiPropertyOptional({ example: '9/XYZ(N)654321' })
  @ValidateIf((dto) => dto.customerType === CustomerType.BUSINESS)
  @IsString()
  contactNrc?: string;
}
