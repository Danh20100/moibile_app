import { Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';

import {
  GOOGLE_ID_TOKEN_VERIFIER,
  verifyGoogleIdToken,
  type GoogleIdTokenVerifier,
} from '../../../integrations/google-identity';
import { TRANSACTION_MANAGER, type TransactionManager } from '../../../persistence/ports/transaction-manager';
import { SessionContext, UserReference, VerifiedPrincipal } from '../contracts';
import { VerifyGoogleTokenDto } from '../dto';

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
    return principal;
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
