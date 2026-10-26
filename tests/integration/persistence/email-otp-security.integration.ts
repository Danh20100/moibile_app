import assert from 'node:assert/strict';
import test from 'node:test';
import { HttpException } from '@nestjs/common';
import { sql } from 'kysely';
import { resetPublicSchema } from './support/postgres-test-harness';
import { runMigrations } from '../../../scripts/database/migrate';
import { createDatabaseClient } from '../../../src/infrastructure/database/database.client';
import { PostgresTransactionManager } from '../../../src/infrastructure/database/postgres-transaction-manager';
import { createRepositorySet } from '../../../src/infrastructure/database/repositories/repository-set';
import { EmailOtpService } from '../../../src/modules/identity-access/services/email-otp.service';
import type {
  EmailSender,
  OutboundEmail,
} from '../../../src/persistence/ports/email-sender.port';

// Synthetic mail capture verifies application behavior only, never SMTP delivery.
class RecordingSender implements EmailSender {
  sent: OutboundEmail[] = [];
  async send(message: OutboundEmail) {
    this.sent.push(message);
  }
  code() {
    return this.sent.at(-1)!.text.match(/\b(\d{6})\b/)![1]!;
  }
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const rejectsCode = (code: string) => (error: unknown) =>
  error instanceof HttpException &&
  (error.getResponse() as { code: string }).code === code;

test('OTP budget, expiry, replay, cooldown, reset binding and late SMTP cleanup use real PostgreSQL', async () => {
  const url = process.env.TEST_DATABASE_URL;
  assert.ok(url, 'isolated TEST_DATABASE_URL required');
  assert.ok(
    !['tro-oi', 'postgres'].includes(new URL(url).pathname.slice(1)),
    'dedicated test database required',
  );
  const db = createDatabaseClient({
    url,
    maxPoolSize: 16,
    connectionTimeoutMs: 5000,
  });
  try {
    await resetPublicSchema(url);
    await runMigrations('up', url);
    const tx = new PostgresTransactionManager(db, createRepositorySet);
    const sender = new RecordingSender();
    const config = {
      enabled: true,
      otpHmacSecret: 'security-integration-hmac-secret-32!',
      smtp: null,
    };
    const service = new EmailOtpService(tx, sender, config);
    const request = (email: string) =>
      service.request({ email, password: 'password1' });
    const row = (id: string) =>
      db
        .selectFrom('identity_otp_challenges')
        .selectAll()
        .where('challenge_id', '=', id)
        .executeTakeFirstOrThrow();
    const age = async (id: string) => {
      await db
        .updateTable('identity_otp_challenges')
        .set({
          created_at: new Date(Date.now() - 120_000).toISOString(),
          last_sent_at: new Date(Date.now() - 120_000).toISOString(),
        })
        .where('challenge_id', '=', id)
        .execute();
    };

    const issued = await request('budget@example.test');
    assert.equal(
      Date.parse(issued.expiresAt) - Date.parse(issued.resendAvailableAt),
      240_000,
    );
    const correct = sender.code();
    const wrong = correct === '000000' ? '000001' : '000000';
    const locked = deferred();
    const release = deferred();
    const blocker = tx.run(async ({ repositories }) => {
      await repositories.identityFoundation.lockMailbox('budget@example.test');
      locked.resolve();
      await release.promise;
    });
    await locked.promise;
    const failures = Array.from({ length: 5 }, () =>
      service
        .verify({ otpChallengeId: issued.otpChallengeId, code: wrong })
        .then(
          () => {
            throw new Error('wrong code accepted');
          },
          (error) => {
            assert.ok(error instanceof HttpException);
          },
        ),
    );
    // Observe all five database lock waiters before queueing the correct code.
    for (let spin = 0; ; spin++) {
      const waits = await sql<{
        count: string;
      }>`SELECT count(*)::text AS count FROM pg_locks WHERE locktype = 'advisory' AND NOT granted`.execute(
        db,
      );
      if (Number(waits.rows[0]!.count) >= 5) break;
      assert.ok(
        spin < 200,
        'five verification requests must reach mailbox lock',
      );
      await new Promise((done) => setTimeout(done, 10));
    }
    const blockedCorrect = service.verify({
      otpChallengeId: issued.otpChallengeId,
      code: correct,
    });
    release.resolve();
    await blocker;
    await Promise.all(failures);
    await assert.rejects(blockedCorrect, rejectsCode('OTP_ATTEMPTS_EXCEEDED'));
    await Promise.all(
      Array.from({ length: 12 }, () =>
        assert.rejects(
          service.verify({
            otpChallengeId: issued.otpChallengeId,
            code: wrong,
          }),
          rejectsCode('OTP_ATTEMPTS_EXCEEDED'),
        ),
      ),
    );
    assert.equal((await row(issued.otpChallengeId)).attempts, 5);
    const audit = await db
      .selectFrom('identity_security_events')
      .selectAll()
      .where('outcome', '=', 'REJECTED')
      .execute();
    assert.ok(audit.length >= 18, 'all rejection events commit');

    const replay = await request('replay@example.test');
    const replayCode = sender.code();
    await service.verify({
      otpChallengeId: replay.otpChallengeId,
      code: replayCode,
    });
    await assert.rejects(
      service.verify({
        otpChallengeId: replay.otpChallengeId,
        code: replayCode,
      }),
      rejectsCode('OTP_INVALID'),
    );
    const reset = await service.requestPasswordReset({
      email: 'replay@example.test',
    });
    assert.equal(
      Date.parse(reset.expiresAt) - Date.parse(reset.resendAvailableAt),
      240_000,
    );
    const resetCode = sender.code();
    await service.verifyPasswordReset({
      otpChallengeId: reset.otpChallengeId,
      code: resetCode,
      password: 'password2',
    });
    await assert.rejects(
      service.requestPasswordReset({ email: 'replay@example.test' }),
      rejectsCode('OTP_RATE_LIMITED'),
    );
    await age(reset.otpChallengeId);
    const staleReset = await service.requestPasswordReset({
      email: 'replay@example.test',
    });
    const staleCode = sender.code();
    await db
      .updateTable('password_credentials')
      .set({ credential_revision: sql`credential_revision + 1` })
      .where(
        'user_id',
        '=',
        (await row(staleReset.otpChallengeId)).reset_user_id!,
      )
      .execute();
    await assert.rejects(
      service.verifyPasswordReset({
        otpChallengeId: staleReset.otpChallengeId,
        code: staleCode,
        password: 'password3',
      }),
      rejectsCode('OTP_INVALID'),
    );

    await age(staleReset.otpChallengeId);
    const staleEmailReset = await service.requestPasswordReset({
      email: 'replay@example.test',
    });
    const staleEmailCode = sender.code();
    await db
      .updateTable('user_emails')
      .set({ email_revision: sql`email_revision + 1` })
      .where(
        'user_id',
        '=',
        (await row(staleEmailReset.otpChallengeId)).reset_user_id!,
      )
      .execute();
    await assert.rejects(
      service.verifyPasswordReset({
        otpChallengeId: staleEmailReset.otpChallengeId,
        code: staleEmailCode,
        password: 'password3',
      }),
      rejectsCode('OTP_INVALID'),
    );
    await age(staleEmailReset.otpChallengeId);
    const failedResetService = new EmailOtpService(
      tx,
      {
        async send() {
          throw new Error('SMTP unavailable');
        },
      },
      config,
    );
    const failedReset = await failedResetService.requestPasswordReset({
      email: 'replay@example.test',
    });
    assert.ok(
      (await row(failedReset.otpChallengeId)).superseded_at,
      'failed recovery delivery invalidates only its challenge',
    );
    await assert.rejects(
      failedResetService.requestPasswordReset({ email: 'replay@example.test' }),
      rejectsCode('OTP_RATE_LIMITED'),
    );
    assert.ok(
      await failedResetService.requestPasswordReset({
        email: 'missing-reset@example.test',
      }),
    );

    const expiring = await request('expiry@example.test');
    const expiryCode = sender.code();
    await db
      .updateTable('identity_otp_challenges')
      .set({
        created_at: new Date(Date.now() - 120_000).toISOString(),
        expires_at: new Date(Date.now() - 1000).toISOString(),
      })
      .where('challenge_id', '=', expiring.otpChallengeId)
      .execute();
    await assert.rejects(
      service.verify({
        otpChallengeId: expiring.otpChallengeId,
        code: expiryCode,
      }),
      rejectsCode('OTP_EXPIRED'),
    );

    const waiting = await request('wait-expiry@example.test');
    const waitingCode = sender.code();
    const expiryLocked = deferred();
    const expiryRelease = deferred();
    const expiryBlocker = tx.run(async ({ repositories }) => {
      await repositories.identityFoundation.lockMailbox(
        'wait-expiry@example.test',
      );
      expiryLocked.resolve();
      await expiryRelease.promise;
    });
    await expiryLocked.promise;
    const waitingVerification = service.verify({
      otpChallengeId: waiting.otpChallengeId,
      code: waitingCode,
    });
    for (let spin = 0; ; spin++) {
      const waits = await sql<{
        count: string;
      }>`SELECT count(*)::text AS count FROM pg_locks WHERE locktype = 'advisory' AND NOT granted`.execute(
        db,
      );
      if (Number(waits.rows[0]!.count) >= 1) break;
      assert.ok(spin < 200, 'verification must wait on mailbox lock');
      await new Promise((done) => setTimeout(done, 10));
    }
    await db
      .updateTable('identity_otp_challenges')
      .set({
        created_at: new Date(Date.now() - 120_000).toISOString(),
        expires_at: new Date(Date.now() - 1000).toISOString(),
      })
      .where('challenge_id', '=', waiting.otpChallengeId)
      .execute();
    expiryRelease.resolve();
    await expiryBlocker;
    await assert.rejects(waitingVerification, rejectsCode('OTP_EXPIRED'));

    const resend = await request('resend@example.test');
    const oldCode = sender.code();
    await age(resend.otpChallengeId);
    const resent = await request('resend@example.test');
    const newCode = sender.code();
    await assert.rejects(
      service.verify({ otpChallengeId: resend.otpChallengeId, code: oldCode }),
      rejectsCode('OTP_INVALID'),
    );
    await service.verify({
      otpChallengeId: resent.otpChallengeId,
      code: newCode,
    });

    const firstSend = deferred();
    const failSend = deferred();
    let first = true;
    const lateSender: EmailSender = {
      async send() {
        if (first) {
          first = false;
          firstSend.resolve();
          await failSend.promise;
          throw new Error('late SMTP failure');
        }
      },
    };
    const lateService = new EmailOtpService(tx, lateSender, config);
    const pending = lateService.request({
      email: 'late@example.test',
      password: 'password1',
    });
    await firstSend.promise;
    const old = await tx.run(({ repositories }) =>
      repositories.identityOtp.findLiveByMailbox(
        'EMAIL_REGISTER',
        'late@example.test',
      ),
    );
    assert.ok(old);
    await age(old.challengeId);
    const replacement = await lateService.request({
      email: 'late@example.test',
      password: 'password1',
    });
    failSend.resolve();
    await assert.rejects(pending, rejectsCode('EMAIL_DELIVERY_FAILED'));
    assert.equal((await row(replacement.otpChallengeId)).superseded_at, null);
    await assert.rejects(
      lateService.request({
        email: 'late@example.test',
        password: 'password1',
      }),
      rejectsCode('OTP_RATE_LIMITED'),
    );
  } finally {
    await db.destroy();
  }
});
