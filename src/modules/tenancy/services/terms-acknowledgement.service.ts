import { randomUUID } from 'node:crypto';

import { BadRequestException, Injectable } from '@nestjs/common';

import { CreateTermsAcknowledgementInput, TermsAcknowledgement } from '../contracts';
import { TenancyParticipantService } from './tenancy-participant.service';
import { TenancyTermsService } from './tenancy-terms.service';

@Injectable()
export class TermsAcknowledgementService {
  private readonly acknowledgements = new Map<string, TermsAcknowledgement>();

  constructor(
    private readonly terms: TenancyTermsService,
    private readonly participants: TenancyParticipantService,
  ) {}

  async acknowledge(input: CreateTermsAcknowledgementInput): Promise<TermsAcknowledgement> {
    const terms = await this.terms.findById(input.tenancyTermsId);
    const participant = await this.participants.findById(input.tenancyParticipantId);
    if (terms.tenancyId !== participant.tenancyId) {
      throw new BadRequestException('Terms and Participant must belong to the same Tenancy');
    }
    if (!participant.userId) {
      throw new BadRequestException('Participant must link a User before acknowledgement');
    }
    if (participant.userId !== input.userId) {
      throw new BadRequestException('Acknowledgement User must match linked Participant User');
    }

    const acknowledgement: TermsAcknowledgement = {
      id: randomUUID(),
      tenancyTermsId: input.tenancyTermsId,
      tenancyParticipantId: input.tenancyParticipantId,
      userId: input.userId,
      acknowledgedAt: input.acknowledgedAt,
    };
    this.acknowledgements.set(acknowledgement.id, structuredClone(acknowledgement));
    return structuredClone(acknowledgement);
  }

  async listByTermsId(tenancyTermsId: string): Promise<TermsAcknowledgement[]> {
    return Array.from(this.acknowledgements.values())
      .filter((acknowledgement) => acknowledgement.tenancyTermsId === tenancyTermsId)
      .map((acknowledgement) => structuredClone(acknowledgement));
  }
}
