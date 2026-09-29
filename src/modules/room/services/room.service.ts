import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PropertyService } from '../../property/services/property.service';
import {
  RoomArchiveBlockers,
  RoomOperationalState,
  RoomOperationalTransitionCause,
  RoomProfile,
} from '../contracts';
import { CreateRoomDto, UpdateRoomDto } from '../dto';

const MANUAL_TRANSITIONS: Record<RoomOperationalState, RoomOperationalState[]> = {
  vacant: ['maintenance', 'inactive'],
  occupied: [],
  maintenance: ['vacant', 'inactive'],
  inactive: ['vacant'],
};

@Injectable()
export class RoomService {
  private readonly rooms = new Map<string, RoomProfile>();

  constructor(
    @Inject(PropertyService) private readonly propertyService: PropertyService,
  ) {}

  async create(dto: CreateRoomDto): Promise<RoomProfile> {
    const property = await this.propertyService.findById(dto.propertyId);
    if (property.lifecycleStatus === 'archived') {
      throw new BadRequestException('Cannot create Room under an archived Property');
    }

    const id = randomUUID();
    const room: RoomProfile = {
      id,
      propertyId: dto.propertyId,
      nameOrLabel: dto.nameOrLabel,
      operationalState: 'vacant',
      recordLifecycle: 'active',
    };
    this.rooms.set(id, structuredClone(room));
    return structuredClone(room);
  }

  async findById(id: string): Promise<RoomProfile> {
    const room = this.rooms.get(id);
    if (!room) {
      throw new NotFoundException(`Không tìm thấy room với id: ${id}`);
    }
    return structuredClone(room);
  }

  async findByPropertyId(propertyId?: string): Promise<RoomProfile[]> {
    const all = Array.from(this.rooms.values());
    const filtered = propertyId ? all.filter((r) => r.propertyId === propertyId) : all;
    return filtered.map((r) => structuredClone(r));
  }

  async update(id: string, dto: UpdateRoomDto): Promise<RoomProfile> {
    const room = await this.findById(id);
    const updated: RoomProfile = {
      ...room,
      nameOrLabel: dto.nameOrLabel ?? room.nameOrLabel,
    };
    this.rooms.set(id, structuredClone(updated));
    return structuredClone(updated);
  }

  async transitionOperationalState(
    id: string,
    nextState: RoomOperationalState,
    cause: RoomOperationalTransitionCause,
  ): Promise<RoomProfile> {
    const room = await this.findById(id);

    if (room.recordLifecycle === 'archived') {
      throw new BadRequestException('Archived Room rejects all operational transitions');
    }

    if (!this.isAllowedTransition(room.operationalState, nextState, cause)) {
      throw new BadRequestException(
        `Invalid Room operational transition ${room.operationalState} -> ${nextState} with cause ${cause}`,
      );
    }

    if (
      cause === 'manual' &&
      room.operationalState === 'inactive' &&
      nextState === 'vacant'
    ) {
      const property = await this.propertyService.findById(room.propertyId);
      if (property.lifecycleStatus === 'archived') {
        throw new BadRequestException(
          'Cannot reactivate inactive Room to vacant under an archived Property',
        );
      }
    }

    const updated: RoomProfile = {
      ...room,
      operationalState: nextState,
    };
    this.rooms.set(id, structuredClone(updated));
    return structuredClone(updated);
  }

  async archive(id: string, blockers: RoomArchiveBlockers): Promise<RoomProfile> {
    const room = await this.findById(id);

    if (room.recordLifecycle === 'archived') {
      throw new BadRequestException('Room is already archived');
    }
    if (room.operationalState !== 'inactive') {
      throw new BadRequestException('Room archive requires operationalState=inactive');
    }
    if (blockers.hasNonTerminalTenancy) {
      throw new BadRequestException('Room archive blocked by non-terminal tenancy');
    }
    if (blockers.hasOpenIncident) {
      throw new BadRequestException('Room archive blocked by open incident');
    }

    const archived: RoomProfile = {
      ...room,
      recordLifecycle: 'archived',
    };
    this.rooms.set(id, structuredClone(archived));
    return structuredClone(archived);
  }

  private isAllowedTransition(
    current: RoomOperationalState,
    next: RoomOperationalState,
    cause: RoomOperationalTransitionCause,
  ): boolean {
    if (cause === 'manual') {
      return MANUAL_TRANSITIONS[current].includes(next);
    }
    if (cause === 'tenancy_activated') {
      return current === 'vacant' && next === 'occupied';
    }
    if (cause === 'checkout_confirmed') {
      return current === 'occupied' && next === 'vacant';
    }
    return false;
  }
}
