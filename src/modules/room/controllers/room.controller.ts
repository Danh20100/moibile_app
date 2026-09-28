import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

import { RoomProfile } from '../contracts';
import { CreateRoomDto, UpdateRoomDto, UpdateRoomOperationalStateDto } from '../dto';
import { RoomService } from '../services/room.service';

@ApiTags('Room')
@Controller('rooms')
export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  @Post()
  @ApiOperation({ summary: 'Tao Room moi (vacant + active)' })
  @ApiResponse({ status: 201, description: 'Room da duoc tao thanh cong' })
  async create(@Body() dto: CreateRoomDto): Promise<RoomProfile> {
    return this.roomService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lay danh sach Room (co the loc theo propertyId)' })
  @ApiQuery({ name: 'propertyId', required: false, description: 'Loc theo Property ID' })
  @ApiResponse({ status: 200, description: 'Danh sach Room' })
  async findByPropertyId(@Query('propertyId') propertyId?: string): Promise<RoomProfile[]> {
    return this.roomService.findByPropertyId(propertyId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lay thong tin chi tiet Room' })
  @ApiResponse({ status: 200, description: 'Thong tin Room' })
  @ApiResponse({ status: 404, description: 'Khong tim thay Room' })
  async findById(@Param('id') id: string): Promise<RoomProfile> {
    return this.roomService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cap nhat nameOrLabel cua Room' })
  @ApiResponse({ status: 200, description: 'Thong tin Room da duoc cap nhat' })
  async update(@Param('id') id: string, @Body() dto: UpdateRoomDto): Promise<RoomProfile> {
    return this.roomService.update(id, dto);
  }

  @Patch(':id/operational-state')
  @ApiOperation({
    summary: 'Chuyen operational state bang cause=manual (khong cho HTTP gia mao tenancy/checkout)',
  })
  @ApiResponse({ status: 200, description: 'Operational state da duoc cap nhat' })
  @ApiResponse({ status: 400, description: 'Chuyen doi operational state khong hop le' })
  async updateOperationalState(
    @Param('id') id: string,
    @Body() dto: UpdateRoomOperationalStateDto,
  ): Promise<RoomProfile> {
    return this.roomService.transitionOperationalState(id, dto.operationalState, 'manual');
  }
}
