import { randomUUID } from 'node:crypto';

import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { TenancyParticipantRecord } from '../../../persistence/ports/tenancy.repository';
import { TRANSACTION_MANAGER, type TransactionManager } from '../../../persistence/ports/transaction-manager';

import {
  AddTenancyParticipantInput,
  TenancyParticipant,
  TenancyParticipantRole,
} from '../contracts';
import { TenancyService } from './tenancy.service';

const PARTICIPANT_ROLES = new Set<TenancyParticipantRole>(['PRIMARY', 'OCCUPANT']);

@Injectable()
export class TenancyParticipantService {
  constructor(private readonly tenancies: TenancyService, @Inject(TRANSACTION_MANAGER) private readonly transactions: TransactionManager) {}

  async add(input: AddTenancyParticipantInput): Promise<TenancyParticipant> {
    await this.tenancies.findById(input.tenancyId);
    if (!PARTICIPANT_ROLES.has(input.role)) {
      throw new BadRequestException('Participant role must be PRIMARY or OCCUPANT');
    }
    if (input.role === 'PRIMARY') {
      const activePrimary = (await this.listActiveByTenancyId(input.tenancyId)).find(
        (participant) => participant.role === 'PRIMARY',
      );
      if (activePrimary) {
        throw new BadRequestException('Tenancy already has an active PRIMARY participant');
      }
    }

    const participant: TenancyParticipant = {
      id: randomUUID(),
      tenancyId: input.tenancyId,
      userId: input.userId,
      role: input.role,
      joinedAt: input.joinedAt,
    };
    await this.transactions.run(({ repositories }) => repositories.tenancy.insertParticipant(this.toRecord(participant)));
    return participant;
  }

  async findById(id: string): Promise<TenancyParticipant> {
    const participant = await this.transactions.run(({ repositories }) => repositories.tenancy.findParticipant(id));
    if (!participant) {
      throw new NotFoundException(`Tenancy participant not found: ${id}`);
    }
    return this.fromRecord(participant);
  }
  async leaveOccupant(id: string, occurredAt: string): Promise<TenancyParticipant> {
    const participant = await this.findById(id);
    if (participant.role !== 'OCCUPANT') {
      throw new BadRequestException('Only OCCUPANT leave is defined in Wave B');
    }
    if (participant.leftAt) {
      throw new BadRequestException('Participant has already left');
    }
    const updated = { ...participant, leftAt: occurredAt };
    await this.transactions.run(({ repositories }) => repositories.tenancy.updateParticipant(this.toRecord(updated)));
    return updated;
  }

  async linkUser(id: string, userId: string): Promise<TenancyParticipant> {
    const participant = await this.findById(id);
    if (participant.userId && participant.userId !== userId) {
      throw new BadRequestException('Participant already links a different User');
    }
    const updated = { ...participant, userId };
    await this.transactions.run(({ repositories }) => repositories.tenancy.updateParticipant(this.toRecord(updated)));
    return updated;
  }

  async listActiveByTenancyId(tenancyId: string): Promise<TenancyParticipant[]> {
    const records = await this.transactions.run(({ repositories }) => repositories.tenancy.findParticipantsByTenancy(tenancyId));
    return records.filter((participant) => !participant.leftAt).map((participant) => this.fromRecord(participant));
  }

  async assertExactlyOneActivePrimary(tenancyId: string): Promise<void> {
    await this.tenancies.findById(tenancyId);
    const activePrimaryCount = (await this.listActiveByTenancyId(tenancyId)).filter(
      (participant) => participant.role === 'PRIMARY',
    ).length;
    if (activePrimaryCount !== 1) {
      throw new BadRequestException('Active Tenancy requires exactly one active PRIMARY participant');
    }
  }

  private toRecord(value: TenancyParticipant): TenancyParticipantRecord {
    return { tenancyParticipantId: value.id, tenancyId: value.tenancyId, userId: value.userId ?? null, role: value.role, joinedAt: value.joinedAt, leftAt: value.leftAt ?? null };
  }

  private fromRecord(value: TenancyParticipantRecord): TenancyParticipant {
    return { id: value.tenancyParticipantId, tenancyId: value.tenancyId, role: value.role as TenancyParticipantRole,
      joinedAt: value.joinedAt, ...(value.userId ? { userId: value.userId } : {}), ...(value.leftAt ? { leftAt: value.leftAt } : {}) };
  }
}
