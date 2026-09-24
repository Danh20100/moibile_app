import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

import { RoomProfile } from '../contracts';
import { CreateRoomDto, UpdateRoomDto, UpdateRoomStatusDto } from '../dto';
import { RoomService } from '../services/room.service';

@ApiTags('Room')
@Controller('rooms')
export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo phòng mới thuộc property (trạng thái ban đầu là draft)' })
  @ApiResponse({ status: 201, description: 'Phòng đã được tạo thành công' })
  async create(@Body() dto: CreateRoomDto): Promise<RoomProfile> {
    return this.roomService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách các phòng (có thể lọc theo propertyId)' })
  @ApiQuery({ name: 'propertyId', required: false, description: 'Lọc theo Property ID' })
  @ApiResponse({ status: 200, description: 'Danh sách phòng' })
  async findByPropertyId(@Query('propertyId') propertyId?: string): Promise<RoomProfile[]> {
    return this.roomService.findByPropertyId(propertyId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin chi tiết một phòng' })
  @ApiResponse({ status: 200, description: 'Thông tin phòng' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy phòng' })
  async findById(@Param('id') id: string): Promise<RoomProfile> {
    return this.roomService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật thông tin phòng (số phòng, giá, diện tích)' })
  @ApiResponse({ status: 200, description: 'Thông tin phòng đã được cập nhật' })
  async update(@Param('id') id: string, @Body() dto: UpdateRoomDto): Promise<RoomProfile> {
    return this.roomService.update(id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Cập nhật trạng thái phòng (tuân theo room lifecycle transition)' })
  @ApiResponse({ status: 200, description: 'Trạng thái phòng đã được cập nhật' })
  @ApiResponse({ status: 400, description: 'Chuyển đổi trạng thái không hợp lệ' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateRoomStatusDto,
  ): Promise<RoomProfile> {
    return this.roomService.updateStatus(id, dto);
  }
}
