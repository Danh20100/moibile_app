import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { OrganizationProfile } from '../contracts';
import { CreateOrganizationDto, UpdateOrganizationDto } from '../dto';
import { OrganizationService } from '../services/organization.service';

@ApiTags('Organization')
@Controller('organizations')
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo rental operating workspace mới' })
  @ApiResponse({ status: 201, description: 'Workspace đã được tạo thành công' })
  async create(@Body() dto: CreateOrganizationDto): Promise<OrganizationProfile> {
    return this.organizationService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách rental operating workspace' })
  @ApiResponse({ status: 200, description: 'Danh sách workspace' })
  async findAll(): Promise<OrganizationProfile[]> {
    return this.organizationService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin chi tiết workspace theo ID' })
  @ApiResponse({ status: 200, description: 'Thông tin chi tiết workspace' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy workspace' })
  async findById(@Param('id') id: string): Promise<OrganizationProfile> {
    return this.organizationService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Đổi tên rental operating workspace' })
  @ApiResponse({ status: 200, description: 'Tên workspace đã được cập nhật' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationDto,
  ): Promise<OrganizationProfile> {
    return this.organizationService.update(id, dto);
  }
}
