import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

import { PropertyProfile } from '../contracts';
import { CreatePropertyDto, UpdatePropertyDto } from '../dto';
import { PropertyService } from '../services/property.service';

@ApiTags('Property')
@Controller('properties')
export class PropertyController {
  constructor(private readonly propertyService: PropertyService) {}

  @Post()
  @ApiOperation({ summary: 'Tao Property / khu tro moi' })
  @ApiResponse({ status: 201, description: 'Property da duoc tao thanh cong' })
  async create(@Body() dto: CreatePropertyDto): Promise<PropertyProfile> {
    return this.propertyService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lay danh sach Property (co the loc theo organizationId)' })
  @ApiQuery({ name: 'organizationId', required: false, description: 'Loc theo Organization ID' })
  @ApiResponse({ status: 200, description: 'Danh sach Property' })
  async findByOrganizationId(
    @Query('organizationId') organizationId?: string,
  ): Promise<PropertyProfile[]> {
    return this.propertyService.findByOrganizationId(organizationId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lay thong tin chi tiet Property' })
  @ApiResponse({ status: 200, description: 'Thong tin Property' })
  @ApiResponse({ status: 404, description: 'Khong tim thay Property' })
  async findById(@Param('id') id: string): Promise<PropertyProfile> {
    return this.propertyService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Cap nhat ten / dia chi / location projection (khong doi lifecycle)',
  })
  @ApiResponse({ status: 200, description: 'Thong tin Property da duoc cap nhat' })
  async update(@Param('id') id: string, @Body() dto: UpdatePropertyDto): Promise<PropertyProfile> {
    return this.propertyService.update(id, dto);
  }
}
