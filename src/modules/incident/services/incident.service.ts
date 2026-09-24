import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

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
  private readonly incidents = new Map<string, IncidentTicket>();

  async create(dto: CreateIncidentDto): Promise<IncidentTicket> {
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
    this.incidents.set(id, incident);
    return incident;
  }

  async findById(id: string): Promise<IncidentTicket> {
    const inc = this.incidents.get(id);
    if (!inc) {
      throw new NotFoundException(`Không tìm thấy incident với id: ${id}`);
    }
    return inc;
  }

  async findByRoomId(roomId?: string): Promise<IncidentTicket[]> {
    const all = Array.from(this.incidents.values());
    if (!roomId) {
      return all;
    }
    return all.filter((i) => i.roomId === roomId);
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
    this.incidents.set(id, updated);
    return updated;
  }
}
