import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { RoomService } from '../../room/services/room.service';
import { IncidentEvent, IncidentStatus, IncidentTicket } from '../contracts';
import { CreateIncidentDto, UpdateIncidentStatusDto } from '../dto';

const VALID_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  REPORTED: ['ACKNOWLEDGED', 'REJECTED'],
  ACKNOWLEDGED: ['IN_PROGRESS', 'REJECTED'],
  IN_PROGRESS: ['RESOLVED'],
  RESOLVED: ['IN_PROGRESS', 'CLOSED'],
  REJECTED: [],
  CLOSED: [],
};

@Injectable()
export class IncidentService {
  private readonly incidents = new Map<string, IncidentTicket>();
  private readonly events: IncidentEvent[] = [];
  constructor(private readonly roomService: RoomService) {}
  async create(dto: CreateIncidentDto): Promise<IncidentTicket> {
    await this.roomService.findById(dto.roomId);
    const value: IncidentTicket = { id: randomUUID(), ...dto, status: 'REPORTED', createdAt: new Date().toISOString() };
    this.incidents.set(value.id, structuredClone(value));
    this.appendEvent({ incidentId: value.id, eventType: 'STATUS_CHANGED', actorUserId: dto.reportedByUserId, toStatus: 'REPORTED', occurredAt: value.createdAt });
    return structuredClone(value);
  }
  async findById(id: string): Promise<IncidentTicket> { const value = this.incidents.get(id); if (!value) throw new NotFoundException(`Incident not found: ${id}`); return structuredClone(value); }
  async findByRoomId(roomId?: string): Promise<IncidentTicket[]> { return Array.from(this.incidents.values()).filter((value) => !roomId || value.roomId === roomId).map((value) => structuredClone(value)); }
  async updateStatus(id: string, dto: UpdateIncidentStatusDto): Promise<IncidentTicket> {
    const current = await this.findById(id); if (!VALID_TRANSITIONS[current.status].includes(dto.status)) throw new BadRequestException(`Invalid Incident transition ${current.status} -> ${dto.status}`);
    const occurredAt = new Date().toISOString();
    const updated: IncidentTicket = { ...current, status: dto.status, closureReason: dto.closureReason ?? current.closureReason, closedAt: ['CLOSED', 'REJECTED'].includes(dto.status) ? occurredAt : undefined };
    this.incidents.set(id, structuredClone(updated));
    this.appendEvent({ incidentId: id, eventType: 'STATUS_CHANGED', actorUserId: dto.actorUserId, note: dto.note, fromStatus: current.status, toStatus: dto.status, occurredAt });
    return structuredClone(updated);
  }
  async listEvents(incidentId: string): Promise<IncidentEvent[]> { return this.events.filter((value) => value.incidentId === incidentId).map((value) => structuredClone(value)); }
  private appendEvent(input: Omit<IncidentEvent, 'id'>): void { this.events.push({ id: randomUUID(), ...structuredClone(input) }); }
}
