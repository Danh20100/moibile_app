import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

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
  private readonly tenancies = new Map<string, TenancyProfile>();

  async create(dto: CreateTenancyDto): Promise<TenancyProfile> {
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
    this.tenancies.set(id, tenancy);
    return tenancy;
  }

  async findById(id: string): Promise<TenancyProfile> {
    const tenancy = this.tenancies.get(id);
    if (!tenancy) {
      throw new NotFoundException(`Không tìm thấy tenancy với id: ${id}`);
    }
    return tenancy;
  }

  async findByRoomId(roomId?: string): Promise<TenancyProfile[]> {
    const all = Array.from(this.tenancies.values());
    if (!roomId) {
      return all;
    }
    return all.filter((t) => t.roomId === roomId);
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
    this.tenancies.set(id, updated);
    return updated;
  }
}
