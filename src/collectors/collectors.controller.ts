import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CollectorsService } from './collectors.service';
import { UpdateCollectorDto } from './dto/update-collector.dto';

@ApiTags('Collectors')
@Controller('collectors')
export class CollectorsController {
  constructor(private readonly collectorsService: CollectorsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all collectors' })
  getAll() {
    return this.collectorsService.getAllCollectors();
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update collector details' })
  updateCollector(@Param('id') id: string, @Body() dto: UpdateCollectorDto) {
    return this.collectorsService.updateCollector(id, dto);
  }
}
