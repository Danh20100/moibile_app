import { randomUUID } from 'node:crypto';

import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { TenancyNoticeRecord } from '../../../persistence/ports/tenancy.repository';
import { TRANSACTION_MANAGER, type TransactionManager } from '../../../persistence/ports/transaction-manager';

import { IssueTenancyNoticeInput, TenancyNotice } from '../contracts';
import { TenancyService } from './tenancy.service';

@Injectable()
export class TenancyNoticeService {
  constructor(private readonly tenancies: TenancyService, @Inject(TRANSACTION_MANAGER) private readonly transactions: TransactionManager) {}

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
    await this.transactions.run(({ repositories }) => repositories.tenancy.insertNotice(this.toRecord(notice)));
    return notice;
  }

  async findById(id: string): Promise<TenancyNotice> {
    const notice = await this.transactions.run(({ repositories }) => repositories.tenancy.findNotice(id));
    if (!notice) {
      throw new NotFoundException(`Tenancy notice not found: ${id}`);
    }
    return this.fromRecord(notice);
  }

  async listByTenancyId(tenancyId: string): Promise<TenancyNotice[]> {
    const records = await this.transactions.run(({ repositories }) => repositories.tenancy.findNoticesByTenancy(tenancyId));
    return records.map((record) => this.fromRecord(record));
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
    await this.transactions.run(({ repositories }) => repositories.tenancy.updateNotice(this.toRecord(updated)));
    return updated;
  }

  private toRecord(value: TenancyNotice): TenancyNoticeRecord {
    return { tenancyNoticeId: value.id, tenancyId: value.tenancyId, noticeType: value.noticeType, issuedByUserId: value.issuedByUserId,
      contentOrNote: value.contentOrNote, issuedAt: value.issuedAt, acknowledgedByUserId: value.acknowledgedByUserId ?? null,
      acknowledgedAt: value.acknowledgedAt ?? null };
  }
  private fromRecord(value: TenancyNoticeRecord): TenancyNotice {
    return { id: value.tenancyNoticeId, tenancyId: value.tenancyId, noticeType: value.noticeType, issuedByUserId: value.issuedByUserId,
      contentOrNote: value.contentOrNote, issuedAt: value.issuedAt,
      ...(value.acknowledgedByUserId ? { acknowledgedByUserId: value.acknowledgedByUserId } : {}),
      ...(value.acknowledgedAt ? { acknowledgedAt: value.acknowledgedAt } : {}) };
  }
}
