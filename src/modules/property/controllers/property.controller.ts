import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

import type { PropertyProfile } from '../contracts';
import { CreatePropertyDto, PropertyProfileDto, UpdatePropertyDto } from '../dto';
import { PropertyService } from '../services/property.service';

@ApiTags('Property')
@Controller('properties')
export class PropertyController {
  constructor(private readonly propertyService: PropertyService) {}

  @Post()
  @ApiOperation({ summary: 'Tao Property / khu tro moi' })
  @ApiResponse({ status: 201, description: 'Property da duoc tao thanh cong', type: PropertyProfileDto })
  async create(@Body() dto: CreatePropertyDto): Promise<PropertyProfile> {
    return this.propertyService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lay danh sach Property (co the loc theo organizationId)' })
  @ApiQuery({ name: 'organizationId', required: false, description: 'Loc theo Organization ID' })
  @ApiResponse({ status: 200, description: 'Danh sach Property', type: [PropertyProfileDto] })
  async findByOrganizationId(
    @Query('organizationId') organizationId?: string,
  ): Promise<PropertyProfile[]> {
    return this.propertyService.findByOrganizationId(organizationId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lay thong tin chi tiet Property' })
  @ApiParam({ name: 'id', type: String, description: 'Property ID' })
  @ApiResponse({ status: 200, description: 'Thong tin Property', type: PropertyProfileDto })
  @ApiResponse({ status: 404, description: 'Khong tim thay Property' })
  async findById(@Param('id') id: string): Promise<PropertyProfile> {
    return this.propertyService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Cap nhat ten / dia chi / location projection (khong doi lifecycle)',
  })
  @ApiParam({ name: 'id', type: String, description: 'Property ID' })
  @ApiResponse({ status: 200, description: 'Thong tin Property da duoc cap nhat', type: PropertyProfileDto })
  async update(@Param('id') id: string, @Body() dto: UpdatePropertyDto): Promise<PropertyProfile> {
    return this.propertyService.update(id, dto);
  }
}
