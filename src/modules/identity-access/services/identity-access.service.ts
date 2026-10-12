import { Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';

import {
  GOOGLE_ID_TOKEN_VERIFIER,
  verifyGoogleIdToken,
  type GoogleIdTokenVerifier,
} from '../../../integrations/google-identity';
import { TRANSACTION_MANAGER, type TransactionManager } from '../../../persistence/ports/transaction-manager';
import { SessionContext, UserReference, VerifiedPrincipal } from '../contracts';
import { VerifyGoogleTokenDto } from '../dto';

const SEEDED_PAYMENT_ROOM = {
  userId: '00000000-0000-4000-8000-000000000001',
  organizationId: '00000000-0000-4000-8000-000000000002',
  tenancyId: '00000000-0000-4000-8000-000000000101',
  participantId: '00000000-0000-4000-8000-000000000102',
} as const;

const SEEDED_A02_TENANT = {
  userId: 'e0080000-0000-4000-8000-000000000001',
  tenancyId: 'e0080000-0000-4000-8000-000000000007',
  participantId: 'e0080000-0000-4000-8000-000000000008',
} as const;

@Injectable()
export class IdentityAccessService {
  private verifier?: GoogleIdTokenVerifier;

  constructor(
    @Inject(TRANSACTION_MANAGER) private readonly transactions: TransactionManager,
    @Optional() @Inject(GOOGLE_ID_TOKEN_VERIFIER) verifier?: GoogleIdTokenVerifier,
  ) {
    this.verifier = verifier;
  }

  async authenticateWithGoogle(dto: VerifyGoogleTokenDto): Promise<VerifiedPrincipal> {
    const principal = await verifyGoogleIdToken(this.verifier, dto.idToken);
    await this.transactions.run(({ repositories }) => repositories.identity.ensureUser(principal.userId));
    await this.claimSeededPaymentRoom(principal.userId);
    return principal;
  }

  private async claimSeededPaymentRoom(userId: string): Promise<void> {
    if (userId === SEEDED_PAYMENT_ROOM.userId || process.env.NODE_ENV === 'production') return;
    await this.transactions.run(async ({ repositories }) => {
      const organization = repositories.organization;
      const tenancy = repositories.tenancy;
      if (!organization?.findOrganization || !tenancy?.findParticipant || !tenancy.updateParticipant) return;
      const org = await organization.findOrganization(SEEDED_PAYMENT_ROOM.organizationId);
      if (org?.primaryOwnerUserId === SEEDED_PAYMENT_ROOM.userId) {
        await organization.updateOrganization({ ...org, primaryOwnerUserId: userId });
      }
      const participant = await tenancy.findParticipant(SEEDED_PAYMENT_ROOM.participantId);
      if (
        participant?.tenancyId === SEEDED_PAYMENT_ROOM.tenancyId &&
        participant.userId === SEEDED_PAYMENT_ROOM.userId &&
        participant.leftAt === null
      ) {
        await tenancy.updateParticipant({ ...participant, userId });
      }
      const a02 = await tenancy.findParticipant(SEEDED_A02_TENANT.participantId);
      if (
        a02?.tenancyId === SEEDED_A02_TENANT.tenancyId &&
        a02.userId === SEEDED_A02_TENANT.userId &&
        a02.leftAt === null
      ) {
        await tenancy.updateParticipant({ ...a02, userId });
      }
    });
  }

  async findUserById(userId: string): Promise<UserReference> {
    const exists = await this.transactions.run(({ repositories }) => repositories.identity.userExists(userId));
    if (!exists) throw new NotFoundException(`Không tìm thấy user với id: ${userId}`);
    return { userId };
  }

  async getSessionContext(principal: VerifiedPrincipal): Promise<SessionContext> {
    const [organizations, participants] = await this.transactions.run(async ({ repositories }) => {
      const orgs = await repositories.organization.findByPrimaryOwnerUserId(principal.userId);
      const parts = await repositories.tenancy.findParticipantsByUser(principal.userId);
      return [orgs, parts];
    });

    const operatedOrganizationIds = Array.from(
      new Set(organizations.map((org) => org.organizationId)),
    ).sort();

    const linkedTenancyIds = Array.from(
      new Set(participants.map((part) => part.tenancyId)),
    ).sort();

    return {
      userId: principal.userId,
      operatedOrganizationIds,
      linkedTenancyIds,
      ...(principal.email !== undefined ? { email: principal.email } : {}),
      ...(principal.name !== undefined ? { name: principal.name } : {}),
      ...(principal.pictureUrl !== undefined ? { pictureUrl: principal.pictureUrl } : {}),
    };
  }
}
