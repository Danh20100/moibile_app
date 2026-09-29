import { randomUUID } from 'node:crypto';

import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { TenancyRecord } from '../../../persistence/ports/tenancy.repository';
import { TRANSACTION_MANAGER, type TransactionManager } from '../../../persistence/ports/transaction-manager';

import { TenancyEndReason, TenancyProfile, TenancyStatus } from '../contracts';

const VALID_TRANSITIONS: Record<TenancyStatus, TenancyStatus[]> = {
  draft: ['active', 'cancelled'],
  active: ['ending'],
  ending: ['active', 'ended'],
  ended: [],
  cancelled: [],
};

const END_REASONS = new Set<TenancyEndReason>([
  'TERM_ENDED',
  'TENANT_INITIATED',
  'OPERATOR_INITIATED',
  'MUTUAL',
  'OTHER',
]);

const NON_TERMINAL = new Set<TenancyStatus>(['draft', 'active', 'ending']);

@Injectable()
export class TenancyService {
  constructor(@Inject(TRANSACTION_MANAGER) private readonly transactions: TransactionManager) {}

  async createDraft(roomId: string): Promise<TenancyProfile> {
    await this.assertCanCreateForRoom(roomId);
    const tenancy: TenancyProfile = {
      id: randomUUID(),
      roomId,
      status: 'draft',
    };
    await this.transactions.run(({ repositories }) => repositories.tenancy.createTenancy(this.toRecord(tenancy)));
    return tenancy;
  }

  async findById(id: string): Promise<TenancyProfile> {
    const tenancy = await this.transactions.run(({ repositories }) => repositories.tenancy.findTenancy(id));
    if (!tenancy) {
      throw new NotFoundException(`Tenancy not found: ${id}`);
    }
    return this.fromRecord(tenancy);
  }

  async findByRoomId(roomId?: string): Promise<TenancyProfile[]> {
    const records = await this.transactions.run(({ repositories }) => repositories.tenancy.findTenanciesByRoom(roomId));
    return records.map((record) => this.fromRecord(record));
  }

  async findNonTerminalByRoomId(
    roomId: string,
    excludeTenancyId?: string,
  ): Promise<TenancyProfile | undefined> {
    const records = await this.transactions.run(({ repositories }) => repositories.tenancy.findNonterminalByRoom(roomId));
    const tenancy = records.map((record) => this.fromRecord(record))
      .find((candidate) => candidate.id !== excludeTenancyId && NON_TERMINAL.has(candidate.status));
    return tenancy;
  }

  async assertCanCreateForRoom(roomId: string): Promise<void> {
    if (await this.findNonTerminalByRoomId(roomId)) {
      throw new BadRequestException('Room already has a non-terminal Tenancy');
    }
  }

  async assertTransition(id: string, next: TenancyStatus): Promise<void> {
    const tenancy = await this.findById(id);
    if (!VALID_TRANSITIONS[tenancy.status].includes(next)) {
      throw new BadRequestException(`Invalid Tenancy transition ${tenancy.status} -> ${next}`);
    }
  }

  async activateLocal(id: string, occurredAt: string): Promise<TenancyProfile> {
    const tenancy = await this.findById(id);
    await this.assertTransition(id, 'active');
    await this.assertNoCompetingNonTerminal(tenancy);
    return this.store({
      ...tenancy,
      status: 'active',
      startedAt: tenancy.startedAt ?? occurredAt,
    });
  }

  async cancel(id: string): Promise<TenancyProfile> {
    const tenancy = await this.findById(id);
    await this.assertTransition(id, 'cancelled');
    return this.store({ ...tenancy, status: 'cancelled' });
  }

  async startEnding(id: string): Promise<TenancyProfile> {
    const tenancy = await this.findById(id);
    await this.assertTransition(id, 'ending');
    return this.store({ ...tenancy, status: 'ending' });
  }

  async resumeActive(id: string): Promise<TenancyProfile> {
    const tenancy = await this.findById(id);
    if (tenancy.status !== 'ending') {
      throw new BadRequestException('Only an ENDING Tenancy can resume ACTIVE');
    }
    await this.assertTransition(id, 'active');
    return this.store({ ...tenancy, status: 'active' });
  }

  async completeCheckoutLocal(
    id: string,
    endReason: TenancyEndReason,
    occurredAt: string,
  ): Promise<TenancyProfile> {
    await this.assertCanCompleteCheckout(id, endReason);
    const tenancy = await this.findById(id);
    return this.store({
      ...tenancy,
      status: 'ended',
      endedAt: occurredAt,
      endReason,
    });
  }

  async assertCanCompleteCheckout(id: string, endReason: TenancyEndReason): Promise<void> {
    if (!END_REASONS.has(endReason)) {
      throw new BadRequestException('Invalid neutral Tenancy end reason');
    }
    await this.assertTransition(id, 'ended');
  }

  private async assertNoCompetingNonTerminal(tenancy: TenancyProfile): Promise<void> {
    if (await this.findNonTerminalByRoomId(tenancy.roomId, tenancy.id)) {
      throw new BadRequestException('Competing non-terminal Tenancy exists for Room');
    }
  }

  private async store(tenancy: TenancyProfile): Promise<TenancyProfile> {
    await this.transactions.run(({ repositories }) => repositories.tenancy.updateTenancy(this.toRecord(tenancy)));
    return tenancy;
  }

  private toRecord(tenancy: TenancyProfile): TenancyRecord {
    return { tenancyId: tenancy.id, roomId: tenancy.roomId, status: tenancy.status.toUpperCase(), startedAt: tenancy.startedAt ?? null, endedAt: tenancy.endedAt ?? null, endReason: tenancy.endReason ?? null };
  }

  private fromRecord(record: TenancyRecord): TenancyProfile {
    return { id: record.tenancyId, roomId: record.roomId, status: record.status.toLowerCase() as TenancyStatus,
      ...(record.startedAt ? { startedAt: record.startedAt } : {}), ...(record.endedAt ? { endedAt: record.endedAt } : {}),
      ...(record.endReason ? { endReason: record.endReason as TenancyEndReason } : {}) };
  }
}
