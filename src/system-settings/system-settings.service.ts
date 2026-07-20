import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UpdateSystemBrandingDto } from './dto/update-system-branding.dto';
import { SystemSetting } from './entities/system-setting.entity';

export type SystemBranding = {
  systemName: string;
  systemTagline: string;
  logoDataUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  receiptCompanyName: string;
  receiptAddress: string;
  receiptPhone: string;
  receiptEmail: string;
  footerText: string;
};

const BRANDING_KEY = 'branding';

const DEFAULT_BRANDING: SystemBranding = {
  systemName: 'Bill Pro',
  systemTagline: 'Billing Management System',
  logoDataUrl: null,
  primaryColor: '#2563EB',
  secondaryColor: '#0F172A',
  receiptCompanyName: 'Bill Pro',
  receiptAddress: '',
  receiptPhone: '',
  receiptEmail: '',
  footerText: '',
};

@Injectable()
export class SystemSettingsService {
  constructor(
    @InjectRepository(SystemSetting)
    private readonly settingsRepository: Repository<SystemSetting>,
  ) {}

  async getBranding(): Promise<SystemBranding> {
    const setting = await this.settingsRepository.findOne({ where: { key: BRANDING_KEY } });
    return this.normalizeBranding(setting?.value as Partial<SystemBranding> | undefined);
  }

  async updateBranding(dto: UpdateSystemBrandingDto): Promise<SystemBranding> {
    const current = await this.getBranding();
    const normalized = this.normalizeBranding({ ...current, ...dto });
    await this.settingsRepository.save({ key: BRANDING_KEY, value: normalized });
    return normalized;
  }

  async resetBranding(): Promise<SystemBranding> {
    await this.settingsRepository.save({ key: BRANDING_KEY, value: DEFAULT_BRANDING });
    return DEFAULT_BRANDING;
  }

  private normalizeBranding(value?: Partial<SystemBranding>): SystemBranding {
    const systemName = this.clean(value?.systemName) || DEFAULT_BRANDING.systemName;
    return {
      systemName,
      systemTagline: this.clean(value?.systemTagline) || DEFAULT_BRANDING.systemTagline,
      logoDataUrl: this.clean(value?.logoDataUrl) || null,
      primaryColor: this.clean(value?.primaryColor) || DEFAULT_BRANDING.primaryColor,
      secondaryColor: this.clean(value?.secondaryColor) || DEFAULT_BRANDING.secondaryColor,
      receiptCompanyName:
        this.clean(value?.receiptCompanyName) || systemName || DEFAULT_BRANDING.receiptCompanyName,
      receiptAddress: this.clean(value?.receiptAddress) || '',
      receiptPhone: this.clean(value?.receiptPhone) || '',
      receiptEmail: this.clean(value?.receiptEmail) || '',
      footerText: this.clean(value?.footerText) || '',
    };
  }

  private clean(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }
}
