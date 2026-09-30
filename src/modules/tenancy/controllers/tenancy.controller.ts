import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { TenancyProfile } from '../contracts';
import { TenancyService } from '../services/tenancy.service';

@ApiTags('Tenancy')
@Controller('tenancies')
export class TenancyController {
  constructor(private readonly tenancyService: TenancyService) {}

  @Get()
  @ApiQuery({ name: 'roomId', required: false })
  async findByRoomId(@Query('roomId') roomId?: string): Promise<TenancyProfile[]> {
    return this.tenancyService.findByRoomId(roomId);
  }

  @Get(':id')
  async findById(@Param('id') id: string): Promise<TenancyProfile> {
    return this.tenancyService.findById(id);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel a DRAFT Tenancy before activation' })
  async cancel(@Param('id') id: string): Promise<TenancyProfile> {
    return this.tenancyService.cancel(id);
  }

  @Post(':id/start-ending')
  @ApiOperation({ summary: 'Start move-out workflow without making Room vacant' })
  async startEnding(@Param('id') id: string): Promise<TenancyProfile> {
    return this.tenancyService.startEnding(id);
  }

  @Post(':id/resume')
  @ApiOperation({ summary: 'Resume ACTIVE state from ENDING' })
  async resume(@Param('id') id: string): Promise<TenancyProfile> {
    return this.tenancyService.resumeActive(id);
  }
}
