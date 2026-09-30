import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

import type { TenancyProfile } from '../contracts';
import { TenancyProfileDto } from '../dto';
import { TenancyService } from '../services/tenancy.service';

@ApiTags('Tenancy')
@Controller('tenancies')
export class TenancyController {
  constructor(private readonly tenancyService: TenancyService) {}

  @Get()
  @ApiOperation({ summary: 'Find tenancies (optionally filtered by roomId)' })
  @ApiQuery({ name: 'roomId', required: false, type: String })
  @ApiResponse({ status: 200, description: 'List of tenancies', type: [TenancyProfileDto] })
  async findByRoomId(@Query('roomId') roomId?: string): Promise<TenancyProfile[]> {
    return this.tenancyService.findByRoomId(roomId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get Tenancy by ID' })
  @ApiParam({ name: 'id', type: String, description: 'Tenancy ID' })
  @ApiResponse({ status: 200, description: 'Tenancy details', type: TenancyProfileDto })
  @ApiResponse({ status: 404, description: 'Tenancy not found' })
  async findById(@Param('id') id: string): Promise<TenancyProfile> {
    return this.tenancyService.findById(id);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel a DRAFT Tenancy before activation' })
  @ApiParam({ name: 'id', type: String, description: 'Tenancy ID' })
  @ApiResponse({ status: 200, description: 'Cancelled tenancy', type: TenancyProfileDto })
  async cancel(@Param('id') id: string): Promise<TenancyProfile> {
    return this.tenancyService.cancel(id);
  }

  @Post(':id/start-ending')
  @ApiOperation({ summary: 'Start move-out workflow without making Room vacant' })
  @ApiParam({ name: 'id', type: String, description: 'Tenancy ID' })
  @ApiResponse({ status: 200, description: 'Ending tenancy', type: TenancyProfileDto })
  async startEnding(@Param('id') id: string): Promise<TenancyProfile> {
    return this.tenancyService.startEnding(id);
  }

  @Post(':id/resume')
  @ApiOperation({ summary: 'Resume ACTIVE state from ENDING' })
  @ApiParam({ name: 'id', type: String, description: 'Tenancy ID' })
  @ApiResponse({ status: 200, description: 'Resumed tenancy', type: TenancyProfileDto })
  async resume(@Param('id') id: string): Promise<TenancyProfile> {
    return this.tenancyService.resumeActive(id);
  }
}
