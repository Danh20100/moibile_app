import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';

import { RoomService } from '../../room/services/room.service';
import { IncidentStatus, IncidentTicket } from '../contracts';
import { CreateIncidentDto, UpdateIncidentStatusDto } from '../dto';

const VALID_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  reported: ['acknowledged'],
  acknowledged: ['processing'],
  processing: ['need_more_information', 'resolved'],
  need_more_information: ['processing'],
  resolved: ['closed'],
  closed: [],
};

@Injectable()
export class IncidentService {
  private static readonly incidents = new Map<string, IncidentTicket>();

  constructor(@Optional() @Inject(RoomService) private readonly roomService?: RoomService) {}

  async create(dto: CreateIncidentDto): Promise<IncidentTicket> {
    if (this.roomService) {
      await this.roomService.findById(dto.roomId);
    }

    const id = `inc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const incident: IncidentTicket = {
      id,
      roomId: dto.roomId,
      reporterId: dto.reporterId,
      title: dto.title,
      description: dto.description,
      category: dto.category,
      status: 'reported',
      createdAt: now,
      updatedAt: now,
    };
    IncidentService.incidents.set(id, incident);
    return { ...incident };
  }

  async findById(id: string): Promise<IncidentTicket> {
    const inc = IncidentService.incidents.get(id);
    if (!inc) {
      throw new NotFoundException(`Không tìm thấy incident với id: ${id}`);
    }
    return { ...inc };
  }

  async findByRoomId(roomId?: string): Promise<IncidentTicket[]> {
    const all = Array.from(IncidentService.incidents.values());
    if (!roomId) {
      return all.map((i) => ({ ...i }));
    }
    return all.filter((i) => i.roomId === roomId).map((i) => ({ ...i }));
  }

  async updateStatus(id: string, dto: UpdateIncidentStatusDto): Promise<IncidentTicket> {
    const incident = await this.findById(id);
    const allowed = VALID_TRANSITIONS[incident.status];

    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Không thể chuyển trạng thái sự cố từ '${incident.status}' sang '${dto.status}'. Chuyển đổi hợp lệ: [${allowed.join(', ')}]`,
      );
    }

    const updated: IncidentTicket = {
      ...incident,
      status: dto.status,
      resolutionNote: dto.note ?? incident.resolutionNote,
      updatedAt: new Date().toISOString(),
    };
    IncidentService.incidents.set(id, updated);
    return { ...updated };
  }
}
