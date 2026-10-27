import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
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
    await this.requirePasswordSetup(principal.userId);
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

  async getOwnContact(principal: VerifiedPrincipal): Promise<{ phoneNumber: string | null; residentialAddress: string | null }> {
    if (!this.database) throw new NotFoundException('Profile storage unavailable');
    const row = await this.database.selectFrom('user_profiles').select(['phone_number', 'residential_address'])
      .where('user_id', '=', principal.userId).executeTakeFirst();
    return { phoneNumber: row?.phone_number ?? null, residentialAddress: row?.residential_address ?? null };
  }

  async updateOwnContact(principal: VerifiedPrincipal, input: { phoneNumber?: string; residentialAddress?: string }) {
    if (!this.database) throw new NotFoundException('Profile storage unavailable');
    if (input.phoneNumber === undefined && input.residentialAddress === undefined) throw new BadRequestException('No contact changes requested');
    const fields: { phone_number?: string | null; residential_address?: string | null; updated_at: string } = {
      updated_at: new Date().toISOString(),
    };
    if (input.phoneNumber !== undefined) {
      if (typeof input.phoneNumber !== 'string') throw new BadRequestException('Invalid contact phone');
      const value = input.phoneNumber.trim();
      if (value && !/^0[0-9]{9,10}$/.test(value)) throw new BadRequestException('Invalid contact phone');
      fields.phone_number = value || null;
    }
    if (input.residentialAddress !== undefined) {
      if (typeof input.residentialAddress !== 'string') throw new BadRequestException('Invalid residential address');
      const value = input.residentialAddress.trim();
      if (value.length > 255 || /[\x00-\x1f\x7f]/.test(value)) throw new BadRequestException('Invalid residential address');
      fields.residential_address = value || null;
    }
    await this.requirePasswordSetup(principal.userId);
    await this.getOwnProfile(principal);
    const updated = await this.database.updateTable('user_profiles').set(fields)
      .where('user_id', '=', principal.userId)
      .returning(['phone_number', 'residential_address']).executeTakeFirstOrThrow();
    return { phoneNumber: updated.phone_number, residentialAddress: updated.residential_address };
  }

  private async requirePasswordSetup(userId: string): Promise<void> {
    if (!this.database) throw new NotFoundException('Profile storage unavailable');
    const credential = await this.database.selectFrom('password_credentials').select('user_id')
      .where('user_id', '=', userId).executeTakeFirst();
    if (!credential) throw new ForbiddenException('Set an account password before editing profile');
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
