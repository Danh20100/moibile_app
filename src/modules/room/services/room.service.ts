import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';

import { PropertyService } from '../../property/services/property.service';
import { RoomProfile, RoomStatus } from '../contracts';
import { CreateRoomDto, UpdateRoomDto, UpdateRoomStatusDto } from '../dto';

const VALID_TRANSITIONS: Record<RoomStatus, RoomStatus[]> = {
  draft: ['vacant'],
  vacant: ['occupied', 'maintenance', 'archived'],
  occupied: ['vacant', 'maintenance'],
  maintenance: ['vacant'],
  archived: [],
};

@Injectable()
export class RoomService {
  private readonly rooms = new Map<string, RoomProfile>();

  constructor(
    @Optional() @Inject(PropertyService) private readonly propertyService?: PropertyService,
  ) {}

  async create(dto: CreateRoomDto): Promise<RoomProfile> {
    if (this.propertyService) {
      await this.propertyService.findById(dto.propertyId);
    }

    const id = `room_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const room: RoomProfile = {
      id,
      propertyId: dto.propertyId,
      roomNumber: dto.roomNumber,
      basePrice: dto.basePrice,
      area: dto.area,
      maxOccupants: dto.maxOccupants,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    };
    this.rooms.set(id, room);
    return { ...room };
  }

  async findById(id: string): Promise<RoomProfile> {
    const room = this.rooms.get(id);
    if (!room) {
      throw new NotFoundException(`Không tìm thấy room với id: ${id}`);
    }
    return { ...room };
  }

  async findByPropertyId(propertyId?: string): Promise<RoomProfile[]> {
    const all = Array.from(this.rooms.values());
    if (!propertyId) {
      return all.map((r) => ({ ...r }));
    }
    return all.filter((r) => r.propertyId === propertyId).map((r) => ({ ...r }));
  }

  async update(id: string, dto: UpdateRoomDto): Promise<RoomProfile> {
    const room = await this.findById(id);
    const updated: RoomProfile = {
      ...room,
      roomNumber: dto.roomNumber ?? room.roomNumber,
      basePrice: dto.basePrice ?? room.basePrice,
      area: dto.area ?? room.area,
      maxOccupants: dto.maxOccupants ?? room.maxOccupants,
      updatedAt: new Date().toISOString(),
    };
    this.rooms.set(id, updated);
    return { ...updated };
  }

  async updateStatus(id: string, dto: UpdateRoomStatusDto): Promise<RoomProfile> {
    const room = await this.findById(id);
    const allowed = VALID_TRANSITIONS[room.status];

    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Không thể chuyển trạng thái phòng từ '${room.status}' sang '${dto.status}'. Chuyển đổi hợp lệ: [${allowed.join(', ')}]`,
      );
    }

    const updated: RoomProfile = {
      ...room,
      status: dto.status,
      updatedAt: new Date().toISOString(),
    };
    this.rooms.set(id, updated);
    return { ...updated };
  }
}
