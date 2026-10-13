import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';

import {
  GOOGLE_ID_TOKEN_VERIFIER,
  verifyGoogleIdToken,
  type GoogleIdTokenVerifier,
} from '../../../integrations/google-identity';
import { TRANSACTION_MANAGER, type TransactionManager } from '../../../persistence/ports/transaction-manager';
import { SessionContext, UserReference, VerifiedPrincipal } from '../contracts';
import { VerifyGoogleTokenDto } from '../dto';
import type { ProfileRecord } from '../../../persistence/ports/identity-foundation.repository';

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
    if (process.env.NODE_ENV !== 'development' || process.env.TROOI_DEMO_CLAIM_USER_ID !== userId || userId === SEEDED_PAYMENT_ROOM.userId) return;
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

  /** Compatibility slice: only a verified User can initialize and edit their own display name.
   * Google-principal mapping, OTP, PIN, credential and audit activation are separate gates.
   */
  async getOwnProfile(principal: VerifiedPrincipal): Promise<ProfileRecord> {
    return this.transactions.run(({ repositories }) =>
      repositories.identityFoundation.initializeProfileIfAbsent({
        userId: principal.userId,
        displayName: principal.name?.trim() || null,
        now: new Date().toISOString(),
      }),
    );
  }

  async updateOwnDisplayName(principal: VerifiedPrincipal, requested: string): Promise<ProfileRecord> {
    const displayName = requested?.trim();
    if (!displayName || Array.from(displayName).length > 80 ||
        Array.from(displayName).some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) {
      throw new BadRequestException('Tên hiển thị phải dài 1–80 ký tự hợp lệ');
    }
    const now = new Date().toISOString();
    return this.transactions.run(async ({ repositories }) => {
      await repositories.identityFoundation.initializeProfileIfAbsent({
        userId: principal.userId,
        displayName: principal.name?.trim() || null,
        now,
      });
      return repositories.identityFoundation.updateOwnDisplayName({
        userId: principal.userId,
        displayName,
        now,
      });
    });
  }

  async getSessionContext(principal: VerifiedPrincipal): Promise<SessionContext> {
    const ownProfile = await this.getOwnProfile(principal);
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
      ...(ownProfile.displayName !== null ? { name: ownProfile.displayName } : {}),
      ...(principal.pictureUrl !== undefined ? { pictureUrl: principal.pictureUrl } : {}),
    };
  }
}
