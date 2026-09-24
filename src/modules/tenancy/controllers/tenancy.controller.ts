import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

import { TenancyProfile } from '../contracts';
import { CreateTenancyDto, UpdateTenancyStatusDto } from '../dto';
import { TenancyService } from '../services/tenancy.service';

@ApiTags('Tenancy')
@Controller('tenancies')
export class TenancyController {
  constructor(private readonly tenancyService: TenancyService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo kỳ thuê mới (hợp đồng thuê) với trạng thái ban đầu draft' })
  @ApiResponse({ status: 201, description: 'Kỳ thuê được tạo thành công' })
  async create(@Body() dto: CreateTenancyDto): Promise<TenancyProfile> {
    return this.tenancyService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách các kỳ thuê (có thể lọc theo roomId)' })
  @ApiQuery({ name: 'roomId', required: false, description: 'Lọc theo Room ID' })
  @ApiResponse({ status: 200, description: 'Danh sách kỳ thuê' })
  async findByRoomId(@Query('roomId') roomId?: string): Promise<TenancyProfile[]> {
    return this.tenancyService.findByRoomId(roomId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin chi tiết một kỳ thuê' })
  @ApiResponse({ status: 200, description: 'Thông tin kỳ thuê' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy kỳ thuê' })
  async findById(@Param('id') id: string): Promise<TenancyProfile> {
    return this.tenancyService.findById(id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Cập nhật trạng thái kỳ thuê (Draft -> Active -> Ending -> Ended)' })
  @ApiResponse({ status: 200, description: 'Trạng thái kỳ thuê đã được cập nhật' })
  @ApiResponse({ status: 400, description: 'Chuyển đổi trạng thái không hợp lệ' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateTenancyStatusDto,
  ): Promise<TenancyProfile> {
    return this.tenancyService.updateStatus(id, dto);
  }
}
