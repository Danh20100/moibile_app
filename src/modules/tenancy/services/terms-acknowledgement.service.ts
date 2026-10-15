import { randomUUID } from 'node:crypto';

import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { TermsAcknowledgementRecord } from '../../../persistence/ports/tenancy.repository';
import { TRANSACTION_MANAGER, type TransactionManager } from '../../../persistence/ports/transaction-manager';

import { CreateTermsAcknowledgementInput, TermsAcknowledgement } from '../contracts';
import { TenancyParticipantService } from './tenancy-participant.service';
import { TenancyTermsService } from './tenancy-terms.service';

@Injectable()
export class TermsAcknowledgementService {
  constructor(
    @Inject(TenancyTermsService) private readonly terms: TenancyTermsService,
    @Inject(TenancyParticipantService) private readonly participants: TenancyParticipantService,
    @Inject(TRANSACTION_MANAGER) private readonly transactions: TransactionManager,
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
    await this.transactions.run(({ repositories }) => repositories.tenancy.insertAcknowledgement(this.toRecord(acknowledgement)));
    return acknowledgement;
  }

  async listByTermsId(tenancyTermsId: string): Promise<TermsAcknowledgement[]> {
    const records = await this.transactions.run(({ repositories }) => repositories.tenancy.findAcknowledgementsByTerms(tenancyTermsId));
    return records.map((record) => this.fromRecord(record));
  }

  private toRecord(value: TermsAcknowledgement): TermsAcknowledgementRecord {
    return { termsAcknowledgementId: value.id, tenancyTermsId: value.tenancyTermsId, tenancyParticipantId: value.tenancyParticipantId, userId: value.userId, acknowledgedAt: value.acknowledgedAt };
  }
  private fromRecord(value: TermsAcknowledgementRecord): TermsAcknowledgement {
    return { id: value.termsAcknowledgementId, tenancyTermsId: value.tenancyTermsId, tenancyParticipantId: value.tenancyParticipantId, userId: value.userId, acknowledgedAt: value.acknowledgedAt };
  }
}
