import assert from 'node:assert/strict';
import test from 'node:test';
import { sql } from 'kysely';
import {
  ConflictException,
  ForbiddenException,
  HttpException,
  ServiceUnavailableException,
} from '@nestjs/common';

import { runMigrations } from '../../../scripts/database/migrate';
import { createDatabaseClient } from '../../../src/infrastructure/database/database.client';
import { PostgresTransactionManager } from '../../../src/infrastructure/database/postgres-transaction-manager';
import { createRepositorySet } from '../../../src/infrastructure/database/repositories/repository-set';
import type {
  EmailSender,
  OutboundEmail,
} from '../../../src/persistence/ports/email-sender.port';
import { IdentitySessionService } from '../../../src/modules/identity-access/services/identity-session.service';
import { issueSessionForUser } from '../../../src/modules/identity-access/services/email-session-issuer';
import { EmailOtpService } from '../../../src/modules/identity-access/services/email-otp.service';
import { loadGooglePrincipals } from '../../support/identity-fixtures';
import { resetPublicSchema } from './support/postgres-test-harness';

class RecordingSender implements EmailSender {
  readonly sent: OutboundEmail[] = [];
  failNext = false;
  async send(message: OutboundEmail): Promise<void> {
    if (this.failNext) {
      this.failNext = false;
      throw new Error('smtp unavailable');
    }
    this.sent.push(message);
  }
}

function codeFrom(sender: RecordingSender): string {
  const match = sender.sent.at(-1)?.text.match(/\b(\d{6})\b/);
  assert.ok(match, 'verification mail must contain a 6-digit code');
  return match[1]!;
}

test('email OTP registration creates a password user and blocks Gmail aliases of a Google account', async () => {
  const url = process.env.TEST_DATABASE_URL;
  assert.ok(url, 'isolated TEST_DATABASE_URL required');
  await resetPublicSchema(url);
  await runMigrations('up', url);
  const database = createDatabaseClient({
    url,
    maxPoolSize: 8,
    connectionTimeoutMs: 5000,
  });
  const transactions = new PostgresTransactionManager(
    database,
    createRepositorySet,
  );
  const sessions = new IdentitySessionService(
    transactions,
    undefined,
    database,
  );
  const previousFlag = process.env.TROOI_IDENTITY_FOUNDATION_RESOLUTION_ENABLED;
  process.env.TROOI_IDENTITY_FOUNDATION_RESOLUTION_ENABLED = 'true';
  try {
    const google = loadGooglePrincipals();
    const sender = new RecordingSender();
    const enabled = new EmailOtpService(transactions, sender, {
      enabled: true,
      otpHmacSecret: 'integration-otp-hmac-secret-32chars!',
      smtp: null,
    });
    const disabled = new EmailOtpService(transactions, sender, {
      enabled: false,
      otpHmacSecret: '',
      smtp: null,
    });

    await assert.rejects(
      () =>
        disabled.request({
          email: 'new.user@example.test',
          password: 'password1',
        }),
      ServiceUnavailableException,
    );

    const first = await enabled.request({
      email: 'New.User@example.test',
      password: 'password1',
      displayName: 'Người thuê',
    });
    assert.equal(sender.sent.length, 1);
    const session = await enabled.verify({
      otpChallengeId: first.otpChallengeId,
      code: codeFrom(sender),
    });
    assert.equal(session.tokenType, 'Bearer');
    assert.ok(session.accessToken);
    const stored = await transactions.run(({ repositories }) =>
      repositories.identityFoundation.findPrimaryLogin('new.user@example.test'),
    );
    assert.equal(stored?.email.verificationSource, 'email_otp');
    assert.ok(stored?.credential);
    const googleBinding = await database
      .selectFrom('auth_identities')
      .select('auth_identity_id')
      .where('user_id', '=', session.userId)
      .executeTakeFirst();
    assert.equal(googleBinding, undefined);

    const login = await sessions.authenticatePassword({
      email: 'new.user@example.test',
      password: 'password1',
    });
    assert.equal(login.userId, session.userId);
    await assert.rejects(
      () =>
        sessions.authenticatePassword({
          email: 'new.user@example.test',
          password: 'wrong-pass',
        }),
      (error: unknown) =>
        error instanceof HttpException &&
        error.getStatus() === 401 &&
        (error.getResponse() as { message?: string }).message ===
          'Email or password is incorrect',
    );
    await assert.rejects(
      () =>
        sessions.authenticatePassword({
          email: 'nobody@example.test',
          password: 'password1',
        }),
      (error: unknown) =>
        error instanceof HttpException &&
        error.getStatus() === 401 &&
        (error.getResponse() as { message?: string }).message ===
          'Email or password is incorrect',
    );

    await assert.rejects(
      () =>
        enabled.request({
          email: 'new.user@example.test',
          password: 'password1',
        }),
      (error: unknown) => {
        assert.ok(error instanceof ConflictException);
        const body = error.getResponse() as {
          code?: string;
          errors?: { signInMethods?: string[] };
        };
        assert.equal(body.code, 'EMAIL_ALREADY_REGISTERED');
        assert.deepEqual(body.errors?.signInMethods, ['password']);
        return true;
      },
    );
    assert.equal(sender.sent.length, 1, 'conflict must not send another mail');

    await assert.rejects(
      () =>
        enabled.request({ email: first.otpChallengeId, password: 'password1' }),
      (error: unknown) =>
        error instanceof HttpException &&
        (error.getResponse() as { code?: string }).code === 'INVALID_EMAIL',
    );

    const now = new Date().toISOString();
    await transactions.run(({ repositories }) =>
      repositories.identityFoundation.createGoogleUserFoundation({
        principal: {
          issuer: 'https://accounts.google.com',
          subject: google.subjectFirst,
        },
        email: {
          address: 'alias.user+tag@gmail.com',
          normalizedEmail: 'alias.user+tag@gmail.com',
          verifiedAt: now,
          verificationSource: 'google',
        },
        displayName: 'Google User',
        now,
      }),
    );
    const beforeGoogleConflict = sender.sent.length;
    await assert.rejects(
      () =>
        enabled.request({
          email: 'aliasuser@gmail.com',
          password: 'password1',
        }),
      (error: unknown) => {
        assert.ok(error instanceof ConflictException);
        const body = error.getResponse() as {
          code?: string;
          errors?: { signInMethods?: string[] };
        };
        assert.equal(body.code, 'EMAIL_ALREADY_REGISTERED');
        assert.deepEqual(body.errors?.signInMethods, ['google']);
        return true;
      },
    );
    await assert.rejects(
      () =>
        enabled.request({
          email: 'alias.user@googlemail.com',
          password: 'password1',
        }),
      ConflictException,
    );
    assert.equal(sender.sent.length, beforeGoogleConflict);
    await assert.rejects(
      () =>
        sessions.authenticatePassword({
          email: 'aliasuser@gmail.com',
          password: 'password1',
        }),
      (error: unknown) =>
        error instanceof HttpException &&
        error.getStatus() === 401 &&
        (error.getResponse() as { message?: string }).message ===
          'Email or password is incorrect',
    );

    const dotted = await enabled.request({
      email: 'dot.user@example.test',
      password: 'password1',
    });
    const dottedCode = codeFrom(sender);
    const compact = await enabled.request({
      email: 'dotuser@example.test',
      password: 'password1',
    });
    const compactCode = codeFrom(sender);
    await enabled.verify({
      otpChallengeId: dotted.otpChallengeId,
      code: dottedCode,
    });
    await enabled.verify({
      otpChallengeId: compact.otpChallengeId,
      code: compactCode,
    });

    const challenge = await enabled.request({
      email: 'retry.user@example.test',
      password: 'password1',
    });
    await assert.rejects(
      () =>
        enabled.request({
          email: 'retry.user@example.test',
          password: 'password1',
        }),
      (error: unknown) =>
        error instanceof HttpException && error.getStatus() === 429,
    );
    const wrongCode = codeFrom(sender) === '000000' ? '000001' : '000000';
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await assert.rejects(
        () =>
          enabled.verify({
            otpChallengeId: challenge.otpChallengeId,
            code: wrongCode,
          }),
        (error: unknown) =>
          error instanceof HttpException &&
          (error.getResponse() as { code?: string }).code === 'OTP_INVALID',
      );
    }
    await assert.rejects(
      () =>
        enabled.verify({
          otpChallengeId: challenge.otpChallengeId,
          code: wrongCode,
        }),
      (error: unknown) =>
        error instanceof HttpException &&
        (error.getResponse() as { code?: string }).code ===
          'OTP_ATTEMPTS_EXCEEDED',
    );

    sender.failNext = true;
    await assert.rejects(
      () =>
        enabled.request({
          email: 'undelivered@example.test',
          password: 'password1',
        }),
      (error: unknown) =>
        error instanceof HttpException &&
        (error.getResponse() as { code?: string }).code ===
          'EMAIL_DELIVERY_FAILED',
    );
    const leftover = await transactions.run(({ repositories }) =>
      repositories.identityOtp.findLiveByMailbox(
        'EMAIL_REGISTER',
        'undelivered@example.test',
      ),
    );
    assert.equal(leftover, null);

    const beforeUnknown = sender.sent.length;
    const unknownReset = await enabled.requestPasswordReset({
      email: 'nobody@example.test',
    });
    const googleReset = await enabled.requestPasswordReset({
      email: 'aliasuser@gmail.com',
    });
    assert.equal(
      sender.sent.length,
      beforeUnknown,
      'unknown or Google-only mailboxes must not receive reset mail',
    );
    assert.ok(unknownReset.otpChallengeId);
    assert.ok(googleReset.otpChallengeId);

    const reset = await enabled.requestPasswordReset({
      email: 'new.user@example.test',
    });
    assert.equal(sender.sent.length, beforeUnknown + 1);
    const resetCode = codeFrom(sender);
    const accepted = await enabled.verifyPasswordReset({
      otpChallengeId: reset.otpChallengeId,
      code: resetCode,
      password: 'password2',
    });
    assert.equal(accepted.reset, true);
    await assert.rejects(
      () =>
        sessions.authenticatePassword({
          email: 'new.user@example.test',
          password: 'password1',
        }),
      (error: unknown) =>
        error instanceof HttpException &&
        error.getStatus() === 401 &&
        (error.getResponse() as { message?: string }).message ===
          'Email or password is incorrect',
    );
    const afterReset = await sessions.authenticatePassword({
      email: 'new.user@example.test',
      password: 'password2',
    });
    assert.equal(afterReset.userId, session.userId);
    await assert.rejects(
      () =>
        enabled.verifyPasswordReset({
          otpChallengeId: unknownReset.otpChallengeId,
          code: '123456',
          password: 'password2',
        }),
      (error: unknown) =>
        error instanceof HttpException &&
        (error.getResponse() as { code?: string }).code === 'OTP_INVALID',
    );

    const googleUser = await transactions.run(({ repositories }) =>
      repositories.identityFoundation.createGoogleUserFoundation({
        principal: {
          issuer: 'https://accounts.google.com',
          subject: google.subjectSecond,
        },
        email: {
          address: 'google.only@example.test',
          normalizedEmail: 'google.only@example.test',
          verifiedAt: now,
          verificationSource: 'google',
        },
        displayName: 'Google Only',
        now,
      }),
    );
    const googleSession = await transactions.run(({ repositories }) =>
      issueSessionForUser(repositories, {
        userId: googleUser.userId,
        now: new Date(),
        authenticatedAt: now,
      }),
    );
    await assert.rejects(
      () =>
        sessions.changeOwnPassword(
          { currentPassword: 'password2', newPassword: 'password3' },
          googleUser.userId,
          googleSession.sessionId,
        ),
      ForbiddenException,
    );
    const beforeChangeMailCount = sender.sent.length;
    await assert.rejects(
      () =>
        sessions.changeOwnPassword(
          { currentPassword: 'wrong-pass', newPassword: 'password3' },
          afterReset.userId,
          afterReset.sessionId,
        ),
      (error: unknown) =>
        error instanceof ForbiddenException &&
        error.message === 'Incorrect password',
    );
    await sessions.configureSecurityPin(
      { password: 'password2', pin: '123456' },
      afterReset.userId,
      afterReset.sessionId,
    );
    const pinBefore = (
      await sql<{ pin_hash: string; revision: string }>`
      SELECT pin_hash, revision::text FROM identity_security_pins
      WHERE user_id = ${afterReset.userId}::uuid
    `.execute(database)
    ).rows[0];
    const changed = await sessions.changeOwnPassword(
      { currentPassword: 'password2', newPassword: 'password3' },
      afterReset.userId,
      afterReset.sessionId,
    );
    assert.equal(changed.changed, true);
    assert.equal(
      sender.sent.length,
      beforeChangeMailCount,
      'current-password change does not send OTP',
    );
    const pinAfter = (
      await sql<{ pin_hash: string; revision: string }>`
      SELECT pin_hash, revision::text FROM identity_security_pins
      WHERE user_id = ${afterReset.userId}::uuid
    `.execute(database)
    ).rows[0];
    assert.ok(pinBefore);
    assert.deepEqual(
      pinAfter,
      pinBefore,
      'password changes preserve the security PIN',
    );
    await assert.rejects(
      () =>
        sessions.authenticatePassword({
          email: 'new.user@example.test',
          password: 'password2',
        }),
      (error: unknown) =>
        error instanceof HttpException && error.getStatus() === 401,
    );
    const afterChange = await sessions.authenticatePassword({
      email: 'new.user@example.test',
      password: 'password3',
    });
    assert.equal(afterChange.userId, session.userId);
    const stillLive = await transactions.run(({ repositories }) =>
      repositories.identitySessions.resolveAccessToken({
        accessTokenSha256: require('node:crypto')
          .createHash('sha256')
          .update(afterReset.accessToken)
          .digest('hex'),
        now: new Date().toISOString(),
      }),
    );
    assert.ok(stillLive, 'current session must survive a password change');
  } finally {
    if (previousFlag === undefined)
      delete process.env.TROOI_IDENTITY_FOUNDATION_RESOLUTION_ENABLED;
    else
      process.env.TROOI_IDENTITY_FOUNDATION_RESOLUTION_ENABLED = previousFlag;
    await database.destroy();
  }
});
