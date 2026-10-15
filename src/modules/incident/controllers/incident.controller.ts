import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CurrentUser, ResourceAuthorizationService } from '../../../common';
import type { VerifiedPrincipal } from '../../identity-access/contracts';
import type { IncidentEvent, IncidentTicket } from '../contracts';
import { CreateIncidentDto, IncidentEventDto, IncidentTicketDto, UpdateIncidentStatusDto } from '../dto';
import { IncidentService } from '../services/incident.service';

@ApiTags('Incident')
@Controller('incidents')
export class IncidentController {
  constructor(
    @Inject(IncidentService)
    private readonly incidentService: IncidentService,
    @Inject(ResourceAuthorizationService)
    private readonly authz: ResourceAuthorizationService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Báo sự cố mới gắn với phòng (trạng thái ban đầu: reported)' })
  @ApiResponse({ status: 201, description: 'Sự cố đã được tạo', type: IncidentTicketDto })
  async create(
    @Body() dto: CreateIncidentDto,
    @CurrentUser() user?: VerifiedPrincipal,
  ): Promise<IncidentTicket> {
    if (user) {
      await this.authz.assertCanAccessRoom(user.userId, dto.roomId);
      dto.reportedByUserId = user.userId;
    }
    return this.incidentService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách các sự cố (có thể lọc theo roomId)' })
  @ApiQuery({ name: 'roomId', required: false, description: 'Lọc theo Room ID' })
  @ApiResponse({ status: 200, description: 'Danh sách sự cố', type: [IncidentTicketDto] })
  async findByRoomId(
    @Query('roomId') roomId?: string,
    @CurrentUser() user?: VerifiedPrincipal,
  ): Promise<IncidentTicket[]> {
    if (roomId) {
      if (user) {
        await this.authz.assertCanAccessRoom(user.userId, roomId);
      }
      return this.incidentService.findByRoomId(roomId);
    }
    if (user) {
      const all = await this.incidentService.findByRoomId();
      const accessible = await Promise.all(
        all.map(async (inc) => {
          try {
            await this.authz.assertCanAccessIncident(user.userId, inc.id);
            return inc;
          } catch {
            return null;
          }
        }),
      );
      return accessible.filter((inc): inc is IncidentTicket => inc !== null);
    }
    return this.incidentService.findByRoomId();
  }

  @Get(':id/events')
  @ApiOperation({ summary: 'Lấy timeline Incident Event theo thứ tự xảy ra' })
  @ApiParam({ name: 'id', type: String, description: 'Incident ID' })
  @ApiResponse({ status: 200, description: 'Incident event timeline', type: [IncidentEventDto] })
  @ApiResponse({ status: 403, description: 'Current user cannot access the Incident' })
  @ApiResponse({ status: 404, description: 'Incident not found' })
  async listEvents(
    @Param('id') id: string,
    @CurrentUser() user?: VerifiedPrincipal,
  ): Promise<IncidentEvent[]> {
    if (user) {
      await this.authz.assertCanAccessIncident(user.userId, id);
    }
    return this.incidentService.listEvents(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin chi tiết một sự cố' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Thông tin sự cố', type: IncidentTicketDto })
  @ApiResponse({ status: 404, description: 'Không tìm thấy sự cố' })
  async findById(
    @Param('id') id: string,
    @CurrentUser() user?: VerifiedPrincipal,
  ): Promise<IncidentTicket> {
    if (user) {
      await this.authz.assertCanAccessIncident(user.userId, id);
    }
    return this.incidentService.findById(id);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary:
      'Chuyển đổi trạng thái xử lý sự cố (acknowledged -> processing -> need_more_information -> resolved -> closed)',
  })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({
    status: 200,
    description: 'Trạng thái sự cố đã được cập nhật',
    type: IncidentTicketDto,
  })
  @ApiResponse({ status: 400, description: 'Chuyển đổi trạng thái không hợp lệ' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateIncidentStatusDto,
    @CurrentUser() user?: VerifiedPrincipal,
  ): Promise<IncidentTicket> {
    if (user) {
      const inc = await this.authz.assertCanAccessIncident(user.userId, id);
      await this.authz.assertOperatesRoom(user.userId, inc.roomId);
      dto.actorUserId = user.userId;
    }
    return this.incidentService.updateStatus(id, dto);
  }
}
