import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

import type { RoomProfile } from '../contracts';
import { CreateRoomDto, RoomProfileDto, UpdateRoomDto } from '../dto';
import { RoomService } from '../services/room.service';

@ApiTags('Room')
@Controller('rooms')
export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  @Post()
  @ApiOperation({ summary: 'Tao Room moi (vacant + active)' })
  @ApiResponse({ status: 201, description: 'Room da duoc tao thanh cong', type: RoomProfileDto })
  async create(@Body() dto: CreateRoomDto): Promise<RoomProfile> {
    return this.roomService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lay danh sach Room (co the loc theo propertyId)' })
  @ApiQuery({ name: 'propertyId', required: false, description: 'Loc theo Property ID' })
  @ApiResponse({ status: 200, description: 'Danh sach Room', type: [RoomProfileDto] })
  async findByPropertyId(@Query('propertyId') propertyId?: string): Promise<RoomProfile[]> {
    return this.roomService.findByPropertyId(propertyId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lay thong tin chi tiet Room' })
  @ApiParam({ name: 'id', type: String, description: 'Room ID' })
  @ApiResponse({ status: 200, description: 'Thong tin Room', type: RoomProfileDto })
  @ApiResponse({ status: 404, description: 'Khong tim thay Room' })
  async findById(@Param('id') id: string): Promise<RoomProfile> {
    return this.roomService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cap nhat nameOrLabel cua Room' })
  @ApiParam({ name: 'id', type: String, description: 'Room ID' })
  @ApiResponse({ status: 200, description: 'Thong tin Room da duoc cap nhat', type: RoomProfileDto })
  async update(@Param('id') id: string, @Body() dto: UpdateRoomDto): Promise<RoomProfile> {
    return this.roomService.update(id, dto);
  }
}
