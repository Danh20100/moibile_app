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
  @ApiOperation({ summary: 'Tạo tài sản / khu trọ mới' })
  @ApiResponse({ status: 201, description: 'Tài sản đã được tạo thành công' })
  async create(@Body() dto: CreatePropertyDto): Promise<PropertyProfile> {
    return this.propertyService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách các tài sản (có thể lọc theo organizationId)' })
  @ApiQuery({ name: 'organizationId', required: false, description: 'Lọc theo Organization ID' })
  @ApiResponse({ status: 200, description: 'Danh sách tài sản' })
  async findByOrganizationId(
    @Query('organizationId') organizationId?: string,
  ): Promise<PropertyProfile[]> {
    return this.propertyService.findByOrganizationId(organizationId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin chi tiết của một tài sản' })
  @ApiResponse({ status: 200, description: 'Thông tin tài sản' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy tài sản' })
  async findById(@Param('id') id: string): Promise<PropertyProfile> {
    return this.propertyService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật thông tin tài sản' })
  @ApiResponse({ status: 200, description: 'Thông tin tài sản đã được cập nhật' })
  async update(@Param('id') id: string, @Body() dto: UpdatePropertyDto): Promise<PropertyProfile> {
    return this.propertyService.update(id, dto);
  }
}
