import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSystemBrandingDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  systemName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  systemTagline?: string;

  @IsOptional()
  @IsString()
  logoDataUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  primaryColor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  secondaryColor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  receiptCompanyName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  receiptAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  receiptPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  receiptEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  footerText?: string;
}
