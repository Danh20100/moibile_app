import { randomUUID } from 'node:crypto';

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { IssueTenancyNoticeInput, TenancyNotice } from '../contracts';
import { TenancyService } from './tenancy.service';

@Injectable()
export class TenancyNoticeService {
  private readonly notices = new Map<string, TenancyNotice>();

  constructor(private readonly tenancies: TenancyService) {}

  async issue(input: IssueTenancyNoticeInput): Promise<TenancyNotice> {
    await this.tenancies.findById(input.tenancyId);
    if (!input.noticeType.trim()) {
      throw new BadRequestException('noticeType must be non-empty');
    }
    if (!input.contentOrNote.trim()) {
      throw new BadRequestException('contentOrNote must be non-empty');
    }
    const notice: TenancyNotice = {
      id: randomUUID(),
      tenancyId: input.tenancyId,
      noticeType: input.noticeType,
      issuedByUserId: input.issuedByUserId,
      contentOrNote: input.contentOrNote,
      issuedAt: input.issuedAt,
    };
    this.notices.set(notice.id, structuredClone(notice));
    return structuredClone(notice);
  }

  async findById(id: string): Promise<TenancyNotice> {
    const notice = this.notices.get(id);
    if (!notice) {
      throw new NotFoundException(`Tenancy notice not found: ${id}`);
    }
    return structuredClone(notice);
  }

  async listByTenancyId(tenancyId: string): Promise<TenancyNotice[]> {
    return Array.from(this.notices.values())
      .filter((notice) => notice.tenancyId === tenancyId)
      .map((notice) => structuredClone(notice));
  }

  async acknowledge(id: string, userId: string, occurredAt: string): Promise<TenancyNotice> {
    const notice = await this.findById(id);
    if (notice.acknowledgedAt || notice.acknowledgedByUserId) {
      throw new BadRequestException('Notice is already acknowledged');
    }
    const updated: TenancyNotice = {
      ...notice,
      acknowledgedByUserId: userId,
      acknowledgedAt: occurredAt,
    };
    this.notices.set(id, structuredClone(updated));
    return structuredClone(updated);
  }
}
