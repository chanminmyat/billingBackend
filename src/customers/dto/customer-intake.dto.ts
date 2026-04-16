import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { BillingCycle } from '../../common/enums/billing-cycle.enum';
import { CustomerStatus } from '../../common/enums/customer-status.enum';
import { CustomerType } from '../../common/enums/customer-type.enum';
import { IpType } from '../../common/enums/ip-type.enum';

export enum FirstInvoiceMode {
  FIXED = 'fixed',
  ANNIVERSARY = 'anniversary',
}

export class PersonalInformationDto {
  @ApiProperty({ example: 'Aung Aung' })
  @IsString()
  name: string;

  @ApiProperty({ example: '7/PAKHANA(N)123412' })
  @IsString()
  nrc: string;
}

export class BusinessInformationDto {
  @ApiProperty({ example: 'ABC Co., Ltd.' })
  @IsString()
  companyName: string;

  @ApiPropertyOptional({ example: 'BRN-001122' })
  @IsOptional()
  @IsString()
  businessRegistrationNumber?: string;

  @ApiPropertyOptional({ example: 'TIN-998877' })
  @IsOptional()
  @IsString()
  taxIdentificationNumber?: string;

  @ApiProperty({ example: 'U Win' })
  @IsString()
  authorizedContactPerson: string;

  @ApiProperty({ example: '1/KHAPHANA(N)123412' })
  @IsString()
  contactNrc: string;
}

export class ContactInformationDto {
  @ApiProperty({ example: '9799773898' })
  @IsString()
  primaryPhone: string;

  @ApiPropertyOptional({ example: '9799773898' })
  @IsOptional()
  @IsString()
  secondaryPhone?: string;

  @ApiPropertyOptional({ example: 'test@gmail.com' })
  @IsOptional()
  @IsEmail()
  email?: string;
}

export class AddressInformationDto {
  @ApiPropertyOptional({ example: '123, street, 5, city, Pyay, Bago Region' })
  @IsOptional()
  @IsString()
  installation?: string;

  @ApiPropertyOptional({ example: 'Same as installation' })
  @IsOptional()
  @IsString()
  billing?: string;

  @ApiPropertyOptional({ example: 'https://maps.google.com/?q=16.8,96.1' })
  @IsOptional()
  @IsString()
  installationMapLink?: string;

  @ApiPropertyOptional({ example: 'https://maps.google.com/?q=16.8,96.1' })
  @IsOptional()
  @IsString()
  billingMapLink?: string;
}

export class ServicesDto {
  @ApiProperty({ example: 'PLAN-BASIC-50' })
  @IsString()
  serviceId: string;

  @ApiProperty({ example: 'Fiber' })
  @IsString()
  serviceType: string;

  @ApiPropertyOptional({ example: 'Basic Plan' })
  @IsOptional()
  @IsString()
  packageName?: string;

  @ApiPropertyOptional({ example: '50/10 Mbps' })
  @IsOptional()
  @IsString()
  bandwidthPlan?: string;

  @ApiPropertyOptional({ example: '2026-01-09' })
  @IsOptional()
  @IsDateString()
  serviceStartDate?: string;

  @ApiPropertyOptional({ example: '2026-01-10' })
  @IsOptional()
  @IsDateString()
  contractStartDate?: string;

  @ApiPropertyOptional({ example: '2027-01-09' })
  @IsOptional()
  @IsDateString()
  contractEndDate?: string;

  @ApiPropertyOptional({ example: '2026-01-10' })
  @IsOptional()
  @IsDateString()
  installationDate?: string;

  @ApiPropertyOptional({ enum: IpType, default: IpType.DYNAMIC })
  @IsOptional()
  @IsEnum(IpType)
  ipType?: IpType;

  @ApiPropertyOptional({ example: '123' })
  @IsOptional()
  @IsString()
  staticIpAddress?: string;
}

export class NetworkTechnicalDto {
  @ApiPropertyOptional({ example: 'asdfasd' })
  @IsOptional()
  @IsString()
  routerId?: string;

  @ApiPropertyOptional({ example: 'AA:BB:CC:DD:EE:FF' })
  @IsOptional()
  @IsString()
  macAddress?: string;

  @ApiPropertyOptional({ example: 'ONU-123456' })
  @IsOptional()
  @IsString()
  onuSerial?: string;

  @ApiPropertyOptional({ example: '1234' })
  @IsOptional()
  @IsString()
  vlanPort?: string;

  @ApiPropertyOptional({ example: 'Zone-A' })
  @IsOptional()
  @IsString()
  networkZone?: string;
}

export class BillingInformationDto {
  @ApiPropertyOptional({ enum: FirstInvoiceMode, default: FirstInvoiceMode.ANNIVERSARY })
  @IsOptional()
  @IsEnum(FirstInvoiceMode)
  firstInvoiceMode?: FirstInvoiceMode;

  @ApiPropertyOptional({ example: 1, minimum: 1, maximum: 31 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(31)
  fixedStartDay?: number;

  @ApiPropertyOptional({ example: 15, minimum: 1, maximum: 31 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(31)
  fixedDueDay?: number;

  @ApiPropertyOptional({ enum: BillingCycle, default: BillingCycle.MONTHLY })
  @IsOptional()
  @IsEnum(BillingCycle)
  billingCycle?: BillingCycle;

  @ApiPropertyOptional({ example: '' })
  @IsOptional()
  @IsString()
  customBillingMonths?: string;

  @ApiPropertyOptional({ example: 9 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  billingDay?: number;

  @ApiPropertyOptional({ example: 'MMK' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ example: 12000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  monthlySubscriptionFee?: number;

  @ApiPropertyOptional({ example: 400 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  installationFee?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  additionalFees?: number;

  @ApiPropertyOptional({ example: 'yes', enum: ['yes', 'no'] })
  @IsOptional()
  @IsString()
  @IsIn(['yes', 'no'])
  collectionService?: 'yes' | 'no';

  @ApiPropertyOptional({ example: 1500 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  collectionFee?: number;

  @ApiPropertyOptional({ example: 'no' })
  @IsOptional()
  @IsString()
  discountApplied?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @ApiPropertyOptional({ example: '' })
  @IsOptional()
  @IsString()
  discountPeriod?: string;
}

export class CustomerIntakeDto {
  @ApiPropertyOptional({
    example: true,
    description: 'If false, customer will be created without initial invoice',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  createInvoiceNow?: boolean;

  @ApiProperty({ enum: CustomerType })
  @IsEnum(CustomerType)
  customerType: CustomerType;

  @ApiPropertyOptional({ enum: CustomerStatus, default: CustomerStatus.ENABLE })
  @IsOptional()
  @IsEnum(CustomerStatus)
  userStatus?: CustomerStatus;

  @ApiPropertyOptional({ type: PersonalInformationDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PersonalInformationDto)
  personalInformation?: PersonalInformationDto | null;

  @ApiPropertyOptional({ type: BusinessInformationDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => BusinessInformationDto)
  businessInformation?: BusinessInformationDto | null;

  @ApiProperty({ type: ContactInformationDto })
  @ValidateNested()
  @Type(() => ContactInformationDto)
  contactInformation: ContactInformationDto;

  @ApiPropertyOptional({ type: AddressInformationDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressInformationDto)
  addressInformation?: AddressInformationDto;

  @ApiProperty({ type: ServicesDto })
  @ValidateNested()
  @Type(() => ServicesDto)
  services: ServicesDto;

  @ApiPropertyOptional({ type: NetworkTechnicalDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => NetworkTechnicalDto)
  networkTechnical?: NetworkTechnicalDto;

  @ApiPropertyOptional({ type: BillingInformationDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => BillingInformationDto)
  billingInformation?: BillingInformationDto;
}
