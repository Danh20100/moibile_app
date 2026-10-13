import { createHash, randomUUID } from 'node:crypto';
import { sql, type Transaction } from 'kysely';
import { googlePrincipalUserId } from '../../../common/identity/deterministic-user-id';
import { normalizeLoginEmail } from '../../../common/identity/normalize-login-email';
import {
  IdentityFoundationConflict,
  type IdentityConflictCode,
  type IdentityFoundationRepository,
  type GooglePrincipal,
  type VerifiedEmail,
  type FoundationInput,
  type EmailRecord,
  type ProfileRecord,
  type CredentialRecord,
  type ProofSnapshot,
  type LoginSnapshot,
} from '../../../persistence/ports/identity-foundation.repository';
import { mapPostgresError } from '../postgres-error.mapper';
import type {
  Database,
  UserEmailsTable,
  UserProfilesTable,
  PasswordCredentialsTable,
} from '../schema.types';

const canonicalIssuer = 'https://accounts.google.com';
const emailRecord = (r: UserEmailsTable): EmailRecord => ({
  userId: r.user_id,
  userEmailId: r.user_email_id,
  address: r.email_address,
  normalizedEmail: r.normalized_email,
  verifiedAt: r.verified_at,
  verificationSource: r.verification_source,
  emailRevision: r.email_revision,
});
const profileRecord = (r: UserProfilesTable): ProfileRecord => ({
  userId: r.user_id,
  displayName: r.display_name,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});
const credentialRecord = (r: PasswordCredentialsTable): CredentialRecord => ({
  userId: r.user_id,
  passwordHash: r.password_hash,
  credentialRevision: r.credential_revision,
  createdAt: r.created_at,
  passwordChangedAt: r.password_changed_at,
});
function fail(code: IdentityConflictCode): never {
  throw new IdentityFoundationConflict(code);
}

export class PostgresIdentityFoundationRepository implements IdentityFoundationRepository {
  constructor(private readonly tx: Transaction<Database>) {
    if (!tx.isTransaction)
      throw new Error('Identity Foundation requires a caller-owned transaction');
  }

  private async execute<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof IdentityFoundationConflict) throw error;
      if (
        typeof error === 'object' &&
        error !== null &&
        'constraint' in error &&
        error.constraint === 'uq_user_emails_address'
      )
        fail('email_conflict');
      throw mapPostgresError(error);
    }
  }

  private async lockUser(userId: string): Promise<void> {
    if (
      !(await this.tx
        .selectFrom('users')
        .select('user_id')
        .where('user_id', '=', userId)
        .forUpdate()
        .executeTakeFirst())
    )
      fail('user_not_found');
  }

  private checkedEmail(email: VerifiedEmail): VerifiedEmail {
    if (
      normalizeLoginEmail(email.address) !== email.normalizedEmail ||
      !['google', 'email_otp'].includes(email.verificationSource) ||
      !Number.isFinite(Date.parse(email.verifiedAt))
    )
      fail('invalid_email');
    return email;
  }

  private checkedHash(hash: string): void {
    // This is storage encoding validation, never password verification or work-factor approval.
    if (
      !/^\$argon2id\$v=19\$m=[1-9][0-9]*,t=[1-9][0-9]*,p=[1-9][0-9]*\$[A-Za-z0-9+/]+\$[A-Za-z0-9+/]+$/.test(
        hash,
      )
    )
      fail('invalid_hash');
  }

  private nextRevision(value: string): string {
    if (!/^[1-9][0-9]*$/.test(value) || BigInt(value) >= 9223372036854775807n)
      fail('revision_exhausted');
    return (BigInt(value) + 1n).toString();
  }

  private async email(userId: string): Promise<EmailRecord | null> {
    const row = await this.tx
      .selectFrom('user_emails')
      .selectAll()
      .where('user_id', '=', userId)
      .executeTakeFirst();
    return row ? emailRecord(row) : null;
  }

  private async credential(userId: string): Promise<CredentialRecord | null> {
    const row = await this.tx
      .selectFrom('password_credentials')
      .selectAll()
      .where('user_id', '=', userId)
      .executeTakeFirst();
    return row ? credentialRecord(row) : null;
  }

  async resolveGooglePrincipal(
    principal: GooglePrincipal,
  ): Promise<{ kind: 'resolved'; userId: string } | { kind: 'unregistered' }> {
    return this.execute(async () => {
      if (
        !['accounts.google.com', canonicalIssuer].includes(principal.issuer) ||
        !principal.subject ||
        principal.subject !== principal.subject.trim()
      )
        fail('invalid_principal');
      const key = createHash('sha256')
        .update(JSON.stringify(['google', canonicalIssuer, principal.subject]))
        .digest()
        .readBigInt64BE()
        .toString();
      await sql`SELECT pg_advisory_xact_lock(${key}::bigint)`.execute(this.tx);
      const mapping = await this.tx
        .selectFrom('auth_identities')
        .selectAll()
        .where('provider', '=', 'google')
        .where('issuer', '=', canonicalIssuer)
        .where('subject', '=', principal.subject)
        .executeTakeFirst();
      const candidates = await this.tx
        .selectFrom('users')
        .select('user_id')
        .where('user_id', 'in', [
          googlePrincipalUserId('accounts.google.com', principal.subject),
          googlePrincipalUserId(canonicalIssuer, principal.subject),
        ])
        .orderBy('user_id')
        .forUpdate()
        .execute();
      if (candidates.length > 1) fail('legacy_conflict');
      if (mapping && (candidates.length !== 1 || mapping.user_id !== candidates[0]!.user_id))
        fail('principal_conflict');
      if (mapping) return { kind: 'resolved', userId: mapping.user_id };
      if (!candidates.length) return { kind: 'unregistered' };
      const userId = candidates[0]!.user_id;
      await this.tx
        .insertInto('auth_identities')
        .values({
          auth_identity_id: randomUUID(),
          user_id: userId,
          provider: 'google',
          issuer: canonicalIssuer,
          subject: principal.subject,
          linked_at: new Date().toISOString(),
        })
        .execute();
      return { kind: 'resolved', userId };
    });
  }

  async createGoogleUserFoundation(
    input: FoundationInput,
  ): Promise<{ userId: string; email: EmailRecord; profile: ProfileRecord }> {
    return this.execute(async () => {
      const state = await this.resolveGooglePrincipal(input.principal);
      if (state.kind !== 'unregistered') fail('stale_state');
      this.checkedEmail(input.email);
      const userId = googlePrincipalUserId(input.principal.issuer, input.principal.subject);
      await this.tx.insertInto('users').values({ user_id: userId }).execute();
      await this.tx
        .insertInto('auth_identities')
        .values({
          auth_identity_id: randomUUID(),
          user_id: userId,
          provider: 'google',
          issuer: canonicalIssuer,
          subject: input.principal.subject,
          linked_at: input.now,
        })
        .execute();
      const initialized = await this.initializeRows(userId, input);
      return { userId, ...initialized };
    });
  }

  private async initializeRows(
    userId: string,
    input: FoundationInput,
  ): Promise<{ email: EmailRecord; profile: ProfileRecord }> {
    let email = await this.email(userId);
    if (!email) {
      const e = this.checkedEmail(input.email);
      email = emailRecord(
        await this.tx
          .insertInto('user_emails')
          .values({
            user_email_id: randomUUID(),
            user_id: userId,
            email_address: e.address,
            normalized_email: e.normalizedEmail,
            verification_source: e.verificationSource,
            verified_at: e.verifiedAt,
            email_revision: '1',
          })
          .returningAll()
          .executeTakeFirstOrThrow(),
      );
    }
    const profile = await this.initializeProfileIfAbsent({
      userId,
      displayName: input.displayName,
      now: input.now,
    });
    return { email, profile };
  }

  async initializeLegacyFoundation(
    input: FoundationInput & { userId: string },
  ): Promise<{ email: EmailRecord; profile: ProfileRecord }> {
    return this.execute(async () => {
      const state = await this.resolveGooglePrincipal(input.principal);
      if (state.kind !== 'resolved' || state.userId !== input.userId) fail('principal_conflict');
      await this.lockUser(input.userId);
      return this.initializeRows(input.userId, input);
    });
  }

  async findPrimaryLogin(
    normalizedEmail: string,
  ): Promise<{ email: EmailRecord; credential: CredentialRecord | null } | null> {
    return this.execute(async () => {
      if (normalizeLoginEmail(normalizedEmail) !== normalizedEmail) fail('invalid_email');
      const row = await this.tx
        .selectFrom('user_emails')
        .selectAll()
        .where('normalized_email', '=', normalizedEmail)
        .executeTakeFirst();
      return row
        ? { email: emailRecord(row), credential: await this.credential(row.user_id) }
        : null;
    });
  }

  async replacePrimaryEmail(input: {
    userId: string;
    expectedEmailId: string;
    expectedEmailRevision: string;
    target: VerifiedEmail;
  }): Promise<EmailRecord> {
    return this.execute(async () => {
      const target = this.checkedEmail(input.target);
      await this.lockUser(input.userId);
      const current = await this.email(input.userId);
      if (
        !current ||
        current.userEmailId !== input.expectedEmailId ||
        current.emailRevision !== input.expectedEmailRevision
      )
        fail('stale_state');
      const revision = this.nextRevision(current.emailRevision);
      return emailRecord(
        await this.tx
          .updateTable('user_emails')
          .set({
            email_address: target.address,
            normalized_email: target.normalizedEmail,
            verified_at: target.verifiedAt,
            verification_source: target.verificationSource,
            email_revision: revision,
          })
          .where('user_id', '=', input.userId)
          .where('email_revision', '=', input.expectedEmailRevision)
          .returningAll()
          .executeTakeFirstOrThrow(),
      );
    });
  }

  async initializeProfileIfAbsent(input: {
    userId: string;
    displayName: string | null;
    now: string;
  }): Promise<ProfileRecord> {
    return this.execute(async () => {
      await this.lockUser(input.userId);
      await this.tx
        .insertInto('user_profiles')
        .values({
          user_id: input.userId,
          display_name: input.displayName,
          created_at: input.now,
          updated_at: input.now,
        })
        .onConflict((c) => c.column('user_id').doNothing())
        .execute();
      return profileRecord(
        await this.tx
          .selectFrom('user_profiles')
          .selectAll()
          .where('user_id', '=', input.userId)
          .executeTakeFirstOrThrow(),
      );
    });
  }

  async updateOwnDisplayName(input: {
    userId: string;
    displayName: string;
    now: string;
  }): Promise<ProfileRecord> {
    return this.execute(async () => {
      await this.lockUser(input.userId);
      if (!input.displayName.trim() || /\p{Cc}/u.test(input.displayName)) fail('invalid_profile');
      const row = await this.tx
        .updateTable('user_profiles')
        .set({ display_name: input.displayName, updated_at: input.now })
        .where('user_id', '=', input.userId)
        .returningAll()
        .executeTakeFirst();
      if (!row) fail('profile_missing');
      return profileRecord(row);
    });
  }

  async insertPasswordCredential(input: {
    userId: string;
    encodedHash: string;
    now: string;
  }): Promise<CredentialRecord> {
    return this.execute(async () => {
      this.checkedHash(input.encodedHash);
      await this.lockUser(input.userId);
      if (
        !(await this.tx
          .selectFrom('auth_identities')
          .select('auth_identity_id')
          .where('user_id', '=', input.userId)
          .executeTakeFirst())
      )
        fail('google_binding_required');
      if (await this.credential(input.userId)) fail('credential_exists');
      return credentialRecord(
        await this.tx
          .insertInto('password_credentials')
          .values({
            user_id: input.userId,
            password_hash: input.encodedHash,
            credential_revision: '1',
            created_at: input.now,
            password_changed_at: input.now,
          })
          .returningAll()
          .executeTakeFirstOrThrow(),
      );
    });
  }

  async replacePasswordCredential(input: {
    userId: string;
    expectedRevision: string;
    encodedHash: string;
    kind: 'change' | 'reset' | 'rehash';
    now: string;
  }): Promise<CredentialRecord> {
    return this.execute(async () => {
      this.checkedHash(input.encodedHash);
      await this.lockUser(input.userId);
      const current = await this.credential(input.userId);
      if (!current || current.credentialRevision !== input.expectedRevision) fail('stale_state');
      return credentialRecord(
        await this.tx
          .updateTable('password_credentials')
          .set({
            password_hash: input.encodedHash,
            credential_revision: this.nextRevision(current.credentialRevision),
            password_changed_at: input.kind === 'rehash' ? current.passwordChangedAt : input.now,
          })
          .where('user_id', '=', input.userId)
          .where('credential_revision', '=', input.expectedRevision)
          .returningAll()
          .executeTakeFirstOrThrow(),
      );
    });
  }

  async validateProofSnapshot(expected: ProofSnapshot): Promise<void> {
    return this.execute(async () => {
      await this.lockUser(expected.userId);
      const email = await this.email(expected.userId),
        credential = await this.credential(expected.userId);
      if (
        !email ||
        email.userEmailId !== expected.userEmailId ||
        email.emailRevision !== expected.emailRevision ||
        (credential?.credentialRevision ?? null) !== expected.credentialRevision
      )
        fail('stale_state');
    });
  }

  async validateLoginSnapshot(expected: LoginSnapshot): Promise<LoginSnapshot> {
    return this.execute(async () => {
      await this.validateProofSnapshot(expected);
      if ((await this.email(expected.userId))?.normalizedEmail !== expected.normalizedEmail)
        fail('stale_state');
      return expected;
    });
  }
}
