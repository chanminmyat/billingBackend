import { Body, Controller, Get, Headers, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateTechnicianApiKeyDto } from './dto/create-technician-api-key.dto';
import { UpdateTechnicianApiKeyStatusDto } from './dto/update-technician-api-key-status.dto';
import { UpdateTechnicianApiKeyDto } from './dto/update-technician-api-key.dto';
import { TechnicianApiService } from './technician-api.service';

@ApiTags('Technician API')
@Controller('technician-api')
export class TechnicianApiController {
  constructor(private readonly technicianApiService: TechnicianApiService) {}

  @Get('keys')
  @ApiOperation({ summary: 'List technician API keys' })
  listKeys() {
    return this.technicianApiService.listKeys();
  }

  @Post('keys')
  @ApiOperation({ summary: 'Create a technician API key' })
  createKey(@Body() dto: CreateTechnicianApiKeyDto) {
    return this.technicianApiService.createKey(dto);
  }

  @Post('keys/:id/rotate')
  @ApiOperation({ summary: 'Rotate a technician API key' })
  rotateKey(@Param('id') id: string) {
    return this.technicianApiService.rotateKey(id);
  }

  @Patch('keys/:id/status')
  @ApiOperation({ summary: 'Activate or deactivate a technician API key' })
  updateKeyStatus(
    @Param('id') id: string,
    @Body() dto: UpdateTechnicianApiKeyStatusDto,
  ) {
    return this.technicianApiService.updateKeyStatus(id, dto.isActive);
  }

  @Patch('keys/:id')
  @ApiOperation({ summary: 'Update technician API key metadata and allowed IPs' })
  updateKey(
    @Param('id') id: string,
    @Body() dto: UpdateTechnicianApiKeyDto,
  ) {
    return this.technicianApiService.updateKey(id, dto);
  }

  @Get('customers')
  @ApiHeader({ name: 'x-technician-api-key', required: true })
  @ApiOperation({ summary: 'Get customer status and network data for technician automation' })
  async getCustomers(
    @Headers('x-technician-api-key') apiKey: string,
    @Headers('x-forwarded-for') forwardedFor: string,
    @Headers('x-real-ip') realIp: string,
    @Req() req: { ip?: string },
    @Query('updatedSince') updatedSince?: string,
  ) {
    await this.technicianApiService.validateApiKey(apiKey, forwardedFor || realIp || req.ip);
    return this.technicianApiService.getCustomerAccessFeed(updatedSince);
  }

  @Get('customers-changes')
  @ApiHeader({ name: 'x-technician-api-key', required: true })
  @ApiOperation({ summary: 'Poll only customer records changed after a specific timestamp' })
  async getCustomerChanges(
    @Headers('x-technician-api-key') apiKey: string,
    @Headers('x-forwarded-for') forwardedFor: string,
    @Headers('x-real-ip') realIp: string,
    @Req() req: { ip?: string },
    @Query('updatedSince') updatedSince?: string,
  ) {
    await this.technicianApiService.validateApiKey(apiKey, forwardedFor || realIp || req.ip);
    return this.technicianApiService.getCustomerAccessChanges(updatedSince);
  }

  @Get('customers/:customerCode')
  @ApiHeader({ name: 'x-technician-api-key', required: true })
  @ApiOperation({ summary: 'Get one customer status and network data for technician automation' })
  async getCustomerByCode(
    @Headers('x-technician-api-key') apiKey: string,
    @Headers('x-forwarded-for') forwardedFor: string,
    @Headers('x-real-ip') realIp: string,
    @Req() req: { ip?: string },
    @Param('customerCode') customerCode: string,
  ) {
    await this.technicianApiService.validateApiKey(apiKey, forwardedFor || realIp || req.ip);
    return this.technicianApiService.getCustomerAccessByCode(customerCode);
  }
}
