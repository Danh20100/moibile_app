import { randomUUID } from 'node:crypto';

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import {
  AddTenancyParticipantInput,
  TenancyParticipant,
  TenancyParticipantRole,
} from '../contracts';
import { TenancyService } from './tenancy.service';

const PARTICIPANT_ROLES = new Set<TenancyParticipantRole>(['PRIMARY', 'OCCUPANT']);

@Injectable()
export class TenancyParticipantService {
  private readonly participants = new Map<string, TenancyParticipant>();

  constructor(private readonly tenancies: TenancyService) {}

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
    this.participants.set(participant.id, structuredClone(participant));
    return structuredClone(participant);
  }

  async findById(id: string): Promise<TenancyParticipant> {
    const participant = this.participants.get(id);
    if (!participant) {
      throw new NotFoundException(`Tenancy participant not found: ${id}`);
    }
    return structuredClone(participant);
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
    this.participants.set(id, structuredClone(updated));
    return structuredClone(updated);
  }

  async linkUser(id: string, userId: string): Promise<TenancyParticipant> {
    const participant = await this.findById(id);
    if (participant.userId && participant.userId !== userId) {
      throw new BadRequestException('Participant already links a different User');
    }
    const updated = { ...participant, userId };
    this.participants.set(id, structuredClone(updated));
    return structuredClone(updated);
  }

  async listActiveByTenancyId(tenancyId: string): Promise<TenancyParticipant[]> {
    return Array.from(this.participants.values())
      .filter((participant) => participant.tenancyId === tenancyId && !participant.leftAt)
      .map((participant) => structuredClone(participant));
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
}
