import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import type { Kysely } from 'kysely';
import { DATABASE_CLIENT } from '../../../infrastructure/database/database.tokens';
import type { Database } from '../../../infrastructure/database/schema.types';
import { TRANSACTION_MANAGER, type TransactionManager } from '../../../persistence/ports/transaction-manager';
import { SessionContext, UserReference, VerifiedPrincipal } from '../contracts';
import { VerifyGoogleTokenDto } from '../dto';
import type { ProfileRecord } from '../../../persistence/ports/identity-foundation.repository';
import { GooglePrincipalResolver } from './google-principal-resolver';

@Injectable()
export class IdentityAccessService {
  private readonly googlePrincipalResolver: Pick<GooglePrincipalResolver, 'resolve'>;

  constructor(
    @Inject(TRANSACTION_MANAGER) private readonly transactions: TransactionManager,
    @Optional() @Inject(GooglePrincipalResolver) googlePrincipalResolver?: Pick<GooglePrincipalResolver, 'resolve'>,
    @Optional() @Inject(DATABASE_CLIENT) private readonly database?: Kysely<Database>,
  ) {
    this.googlePrincipalResolver = googlePrincipalResolver ?? new GooglePrincipalResolver(transactions);
  }

  async authenticateWithGoogle(dto: VerifyGoogleTokenDto): Promise<VerifiedPrincipal> {
    return this.googlePrincipalResolver.resolve(dto.idToken);
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

    const verifiedEmail = this.database ? await this.database.selectFrom('user_emails')
      .select('email_address').where('user_id', '=', principal.userId).executeTakeFirst() : null;
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
      ...(verifiedEmail?.email_address ? { email: verifiedEmail.email_address } :
        principal.email !== undefined ? { email: principal.email } : {}),
      ...(ownProfile.displayName !== null ? { name: ownProfile.displayName } : {}),
      ...(principal.pictureUrl !== undefined ? { pictureUrl: principal.pictureUrl } : {}),
    };
  }
}
