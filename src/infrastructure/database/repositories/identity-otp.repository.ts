import { sql, type Transaction } from 'kysely';

import type {
  IdentityOtpRepository,
  OtpChallengeCreateInput,
  OtpChallengePurpose,
  OtpChallengeRecord,
} from '../../../persistence/ports/identity-otp.repository';
import { mapPostgresError } from '../postgres-error.mapper';
import type { Database, IdentityOtpChallengesTable } from '../schema.types';

const challengeRecord = (
  r: IdentityOtpChallengesTable,
): OtpChallengeRecord => ({
  challengeId: r.challenge_id,
  purpose: r.purpose,
  destinationAddress: r.destination_address,
  destinationNormalized: r.destination_normalized,
  displayName: r.display_name,
  pendingPasswordHash: r.pending_password_hash,
  resetUserId: r.reset_user_id,
  resetEmailRevision: r.reset_email_revision,
  resetCredentialRevision: r.reset_credential_revision,
  changeUserId: r.change_user_id,
  changeSessionId: r.change_session_id,
  changeEmailId: r.change_email_id,
  changeEmailRevision: r.change_email_revision,
  changeStage: r.change_stage,
  changeTargetAddress: r.change_target_address,
  changeTargetNormalized: r.change_target_normalized,
  codeHmac: r.code_hmac,
  createdAt: r.created_at,
  expiresAt: r.expires_at,
  lastSentAt: r.last_sent_at,
  attempts: r.attempts,
  maxAttempts: r.max_attempts,
});

export class PostgresIdentityOtpRepository implements IdentityOtpRepository {
  constructor(private readonly tx: Transaction<Database>) {
    if (!tx.isTransaction)
      throw new Error(
        'Identity OTP challenges require a caller-owned transaction',
      );
  }

  private async execute<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      throw mapPostgresError(error);
    }
  }

  async findLiveByMailbox(
    purpose: OtpChallengePurpose,
    normalizedEmail: string,
  ): Promise<OtpChallengeRecord | null> {
    return this.execute(async () => {
      const row = await this.tx
        .selectFrom('identity_otp_challenges')
        .selectAll()
        .where('purpose', '=', purpose)
        .where('consumed_at', 'is', null)
        .where('superseded_at', 'is', null)
        .where(
          sql<boolean>`trooi_canonical_email(destination_normalized) = trooi_canonical_email(${normalizedEmail})`,
        )
        .executeTakeFirst();
      return row ? challengeRecord(row) : null;
    });
  }

  async findLatestByMailbox(
    purpose: OtpChallengePurpose,
    normalizedEmail: string,
  ): Promise<OtpChallengeRecord | null> {
    return this.execute(async () => {
      const row = await this.tx
        .selectFrom('identity_otp_challenges')
        .selectAll()
        .where('purpose', '=', purpose)
        .where(
          sql<boolean>`trooi_canonical_email(destination_normalized) = trooi_canonical_email(${normalizedEmail})`,
        )
        .orderBy('created_at', 'desc')
        .executeTakeFirst();
      return row ? challengeRecord(row) : null;
    });
  }

  async findLatestLiveEmailChangeByUser(userId: string): Promise<OtpChallengeRecord | null> {
    return this.execute(async () => {
      const row = await this.tx.selectFrom('identity_otp_challenges').selectAll()
        .where('purpose', '=', 'EMAIL_CHANGE')
        .where('change_user_id', '=', userId)
        .where('consumed_at', 'is', null)
        .where('superseded_at', 'is', null)
        .orderBy('created_at', 'desc')
        .executeTakeFirst();
      return row ? challengeRecord(row) : null;
    });
  }

  async advanceEmailChangeStage(input: {
    challengeId: string; userId: string; sessionId: string; emailId: string;
    emailRevision: string; fromStage: 'CURRENT_EMAIL'; expectedDestinationNormalized: string;
    targetAddress: string; targetNormalized: string; codeHmac: string; now: string;
  }): Promise<boolean> {
    return this.execute(async () => {
      const row = await this.tx.updateTable('identity_otp_challenges')
        .set({
          change_stage: 'NEW_EMAIL',
          destination_address: input.targetAddress,
          destination_normalized: input.targetNormalized,
          code_hmac: input.codeHmac,
          attempts: 0,
          last_sent_at: input.now,
        })
        .where('challenge_id', '=', input.challengeId)
        .where('purpose', '=', 'EMAIL_CHANGE')
        .where('change_stage', '=', input.fromStage)
        .where('change_user_id', '=', input.userId)
        .where('change_session_id', '=', input.sessionId)
        .where('change_email_id', '=', input.emailId)
        .where('change_email_revision', '=', input.emailRevision)
        .where('destination_normalized', '=', input.expectedDestinationNormalized)
        .where('attempts', '<', sql<number>`max_attempts`)
        .where('expires_at', '>', input.now)
        .where(sql<boolean>`expires_at::timestamptz > clock_timestamp()`)
        .where('consumed_at', 'is', null)
        .where('superseded_at', 'is', null)
        .returning('challenge_id')
        .executeTakeFirst();
      return Boolean(row);
    });
  }

  async supersedeById(input: {
    challengeId: string;
    now: string;
  }): Promise<void> {
    await this.execute(async () => {
      await this.tx
        .updateTable('identity_otp_challenges')
        .set({ superseded_at: input.now })
        .where('challenge_id', '=', input.challengeId)
        .where('consumed_at', 'is', null)
        .where('superseded_at', 'is', null)
        .execute();
    });
  }

  async findLiveById(challengeId: string): Promise<OtpChallengeRecord | null> {
    return this.execute(async () => {
      const row = await this.tx
        .selectFrom('identity_otp_challenges')
        .selectAll()
        .where('challenge_id', '=', challengeId)
        .where('consumed_at', 'is', null)
        .where('superseded_at', 'is', null)
        .executeTakeFirst();
      return row ? challengeRecord(row) : null;
    });
  }

  async supersedeLiveByMailbox(input: {
    purpose: OtpChallengePurpose;
    normalizedEmail: string;
    now: string;
  }): Promise<void> {
    await this.execute(async () => {
      await this.tx
        .updateTable('identity_otp_challenges')
        .set({ superseded_at: input.now })
        .where('purpose', '=', input.purpose)
        .where('consumed_at', 'is', null)
        .where('superseded_at', 'is', null)
        .where(
          sql<boolean>`trooi_canonical_email(destination_normalized) = trooi_canonical_email(${input.normalizedEmail})`,
        )
        .execute();
    });
  }

  async createChallenge(
    input: OtpChallengeCreateInput,
  ): Promise<OtpChallengeRecord> {
    return this.execute(async () =>
      challengeRecord(
        await this.tx
          .insertInto('identity_otp_challenges')
          .values({
            challenge_id: input.challengeId,
            purpose: input.purpose,
            destination_address: input.destinationAddress,
            destination_normalized: input.destinationNormalized,
            code_hmac: input.codeHmac,
            pending_password_hash: input.pendingPasswordHash,
            reset_user_id: input.resetUserId ?? null,
            reset_email_revision: input.resetEmailRevision ?? null,
            reset_credential_revision: input.resetCredentialRevision ?? null,
            change_user_id: input.changeUserId ?? null,
            change_session_id: input.changeSessionId ?? null,
            change_email_id: input.changeEmailId ?? null,
            change_email_revision: input.changeEmailRevision ?? null,
            change_stage: input.changeStage ?? null,
            change_target_address: input.changeTargetAddress ?? null,
            change_target_normalized: input.changeTargetNormalized ?? null,
            display_name: input.displayName,
            created_at: input.createdAt,
            expires_at: input.expiresAt,
            last_sent_at: input.createdAt,
            attempts: 0,
            max_attempts: input.maxAttempts,
            consumed_at: null,
            superseded_at: null,
          })
          .returningAll()
          .executeTakeFirstOrThrow(),
      ),
    );
  }

  async recordFailedAttempt(challengeId: string): Promise<number> {
    return this.execute(async () => {
      const row = await this.tx
        .updateTable('identity_otp_challenges')
        .set({ attempts: sql<number>`least(attempts + 1, max_attempts)` })
        .where('challenge_id', '=', challengeId)
        .where('consumed_at', 'is', null)
        .where('superseded_at', 'is', null)
        .returning('attempts')
        .executeTakeFirst();
      return row?.attempts ?? 0;
    });
  }

  async consume(input: { challengeId: string; now: string }): Promise<boolean> {
    return this.execute(async () => {
      const row = await this.tx
        .updateTable('identity_otp_challenges')
        .set({ consumed_at: input.now })
        .where(sql<boolean>`attempts < max_attempts`)
        .where('expires_at', '>', input.now)
        .where(sql<boolean>`expires_at::timestamptz > clock_timestamp()`)
        .where('challenge_id', '=', input.challengeId)
        .where('consumed_at', 'is', null)
        .where('superseded_at', 'is', null)
        .returning('challenge_id')
        .executeTakeFirst();
      return Boolean(row);
    });
  }

  async deleteSettledBefore(cutoff: string): Promise<void> {
    await this.execute(async () => {
      await this.tx
        .deleteFrom('identity_otp_challenges')
        .where('created_at', '<', cutoff)
        .execute();
    });
  }
}
