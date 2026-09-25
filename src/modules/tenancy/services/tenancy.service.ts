import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';

import { RoomService } from '../../room/services/room.service';
import { TenancyProfile, TenancyStatus } from '../contracts';
import { CreateTenancyDto, UpdateTenancyStatusDto } from '../dto';

const VALID_TRANSITIONS: Record<TenancyStatus, TenancyStatus[]> = {
  draft: ['active'],
  active: ['ending', 'ended'],
  ending: ['ended'],
  ended: [],
};

@Injectable()
export class TenancyService {
  private static readonly tenancies = new Map<string, TenancyProfile>();

  constructor(@Optional() @Inject(RoomService) private readonly roomService?: RoomService) {}

  async create(dto: CreateTenancyDto): Promise<TenancyProfile> {
    if (this.roomService) {
      await this.roomService.findById(dto.roomId);
    }

    if (dto.endDate && new Date(dto.endDate) < new Date(dto.startDate)) {
      throw new BadRequestException('Ngày kết thúc hợp đồng thuê không được sớm hơn ngày bắt đầu');
    }

    const id = `ten_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const tenancy: TenancyProfile = {
      id,
      roomId: dto.roomId,
      tenantId: dto.tenantId,
      terms: {
        monthlyRent: dto.monthlyRent,
        depositAmount: dto.depositAmount,
        paymentDueDay: dto.paymentDueDay,
        startDate: dto.startDate,
        endDate: dto.endDate,
      },
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    };
    TenancyService.tenancies.set(id, tenancy);
    return { ...tenancy, terms: { ...tenancy.terms } };
  }

  async findById(id: string): Promise<TenancyProfile> {
    const tenancy = TenancyService.tenancies.get(id);
    if (!tenancy) {
      throw new NotFoundException(`Không tìm thấy tenancy với id: ${id}`);
    }
    return { ...tenancy, terms: { ...tenancy.terms } };
  }

  async findByRoomId(roomId?: string): Promise<TenancyProfile[]> {
    const all = Array.from(TenancyService.tenancies.values());
    if (!roomId) {
      return all.map((t) => ({ ...t, terms: { ...t.terms } }));
    }
    return all.filter((t) => t.roomId === roomId).map((t) => ({ ...t, terms: { ...t.terms } }));
  }

  async updateStatus(id: string, dto: UpdateTenancyStatusDto): Promise<TenancyProfile> {
    const tenancy = await this.findById(id);
    const allowed = VALID_TRANSITIONS[tenancy.status];

    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Không thể chuyển trạng thái hợp đồng thuê từ '${tenancy.status}' sang '${dto.status}'. Chuyển đổi hợp lệ: [${allowed.join(', ')}]`,
      );
    }

    const updated: TenancyProfile = {
      ...tenancy,
      status: dto.status,
      updatedAt: new Date().toISOString(),
    };
    TenancyService.tenancies.set(id, updated);
    return { ...updated, terms: { ...updated.terms } };
  }
}
