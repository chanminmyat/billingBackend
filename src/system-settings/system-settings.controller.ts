import { Body, Controller, Delete, Get, Patch } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UpdateSystemBrandingDto } from './dto/update-system-branding.dto';
import { SystemSettingsService } from './system-settings.service';

@ApiTags('system-settings')
@Controller('system-settings')
export class SystemSettingsController {
  constructor(private readonly systemSettingsService: SystemSettingsService) {}

  @Get('branding')
  @ApiOperation({ summary: 'Get shared system branding and receipt company information' })
  getBranding() {
    return this.systemSettingsService.getBranding();
  }

  @Patch('branding')
  @ApiOperation({ summary: 'Update shared system branding and receipt company information' })
  updateBranding(@Body() dto: UpdateSystemBrandingDto) {
    return this.systemSettingsService.updateBranding(dto);
  }

  @Delete('branding')
  @ApiOperation({ summary: 'Reset shared system branding to defaults' })
  resetBranding() {
    return this.systemSettingsService.resetBranding();
  }
}
