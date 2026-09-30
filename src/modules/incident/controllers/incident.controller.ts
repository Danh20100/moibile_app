import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

import type { IncidentTicket } from '../contracts';
import { CreateIncidentDto, IncidentTicketDto, UpdateIncidentStatusDto } from '../dto';
import { IncidentService } from '../services/incident.service';

@ApiTags('Incident')
@Controller('incidents')
export class IncidentController {
  constructor(private readonly incidentService: IncidentService) {}

  @Post()
  @ApiOperation({ summary: 'Báo sự cố mới gắn với phòng (trạng thái ban đầu: reported)' })
  @ApiResponse({ status: 201, description: 'Sự cố đã được tạo', type: IncidentTicketDto })
  async create(@Body() dto: CreateIncidentDto): Promise<IncidentTicket> {
    return this.incidentService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách các sự cố (có thể lọc theo roomId)' })
  @ApiQuery({ name: 'roomId', required: false, description: 'Lọc theo Room ID' })
  @ApiResponse({ status: 200, description: 'Danh sách sự cố', type: [IncidentTicketDto] })
  async findByRoomId(@Query('roomId') roomId?: string): Promise<IncidentTicket[]> {
    return this.incidentService.findByRoomId(roomId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin chi tiết một sự cố' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Thông tin sự cố', type: IncidentTicketDto })
  @ApiResponse({ status: 404, description: 'Không tìm thấy sự cố' })
  async findById(@Param('id') id: string): Promise<IncidentTicket> {
    return this.incidentService.findById(id);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary:
      'Chuyển đổi trạng thái xử lý sự cố (acknowledged -> processing -> need_more_information -> resolved -> closed)',
  })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Trạng thái sự cố đã được cập nhật', type: IncidentTicketDto })
  @ApiResponse({ status: 400, description: 'Chuyển đổi trạng thái không hợp lệ' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateIncidentStatusDto,
  ): Promise<IncidentTicket> {
    return this.incidentService.updateStatus(id, dto);
  }
}
