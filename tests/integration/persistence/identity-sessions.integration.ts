import assert from 'node:assert/strict';
import test from 'node:test';

import { createDatabaseClient } from '../../../src/infrastructure/database/database.client';
import { PostgresTransactionManager } from '../../../src/infrastructure/database/postgres-transaction-manager';
import { createRepositorySet } from '../../../src/infrastructure/database/repositories/repository-set';
import { IdentitySessionService } from '../../../src/modules/identity-access/services/identity-session.service';
import { googlePrincipalUserId } from '../../../src/common/identity/deterministic-user-id';
import { UnauthorizedException, ServiceUnavailableException } from '@nestjs/common';
import { runMigrations } from '../../../scripts/database/migrate';
import { resetPublicSchema } from './support/postgres-test-harness';

test('Identity challenge consumption, refresh rotation/reuse, revocation and append-only audit persist in PostgreSQL', async () => {
  const url = process.env.TEST_DATABASE_URL;
  assert.ok(url, 'isolated TEST_DATABASE_URL required');
  await resetPublicSchema(url);
  await runMigrations('up', url);
  const database = createDatabaseClient({ url, maxPoolSize: 8, connectionTimeoutMs: 5000 });
  const transactions = new PostgresTransactionManager(database, createRepositorySet);
  const userId = 'a6000000-0000-4000-8000-000000000001';
  const sessionId = 'a6000000-0000-4000-8000-000000000002';
  const now = '2026-10-15T00:00:00.000Z';
  const previousGate = process.env.TROOI_IDENTITY_FOUNDATION_RESOLUTION_ENABLED;
  process.env.TROOI_IDENTITY_FOUNDATION_RESOLUTION_ENABLED = 'true';
  try {
    await transactions.run(({ repositories }) => repositories.identity.ensureUser(userId));
    const challenge = { challengeId: 'a6000000-0000-4000-8000-000000000003', purpose: 'REGISTER' as const,
      nonceSha256: 'c'.repeat(64), userId: null, sessionId: null, createdAt: now,
      expiresAt: '2026-10-15T00:05:00.000Z' };
    await transactions.run(({ repositories }) => repositories.identitySessions.createChallenge(challenge));
    assert.deepEqual(await transactions.run(({ repositories }) => repositories.identitySessions.consumeChallenge({
      nonceSha256: challenge.nonceSha256, purpose: 'REGISTER', now,
    })), { challengeId: challenge.challengeId, userId: null, sessionId: null });
    assert.equal(await transactions.run(({ repositories }) => repositories.identitySessions.consumeChallenge({
      nonceSha256: challenge.nonceSha256, purpose: 'REGISTER', now,
    })), null, 'a challenge is one-use');

    await transactions.run(({ repositories }) => repositories.identitySessions.createSession({
      sessionId, familyId: sessionId, userId, accessTokenSha256: 'a'.repeat(64),
      accessExpiresAt: '2026-10-15T00:15:00.000Z', refreshTokenSha256: 'b'.repeat(64),
      createdAt: now, idleExpiresAt: '2026-11-14T00:00:00.000Z',
      absoluteExpiresAt: '2027-01-13T00:00:00.000Z', authenticatedAt: now,
    }));
    assert.deepEqual(await transactions.run(({ repositories }) => repositories.identitySessions.resolveAccessToken({
      accessTokenSha256: 'a'.repeat(64), now,
    })), { sessionId, userId, authenticatedAt: now });

    const attempts = await Promise.all(['d', 'e'].map((suffix) => transactions.run(({ repositories }) =>
      repositories.identitySessions.rotateRefreshToken({
        oldRefreshTokenSha256: 'b'.repeat(64), newRefreshTokenSha256: suffix.repeat(64),
        newAccessTokenSha256: suffix === 'd' ? 'f'.repeat(64) : '1'.repeat(64),
        now: '2026-10-15T00:01:00.000Z', accessExpiresAt: '2026-10-15T00:16:00.000Z',
      }),
    )));
    assert.deepEqual(attempts.map((result) => result.kind).sort(), ['reused', 'rotated']);
    assert.equal(await transactions.run(({ repositories }) => repositories.identitySessions.resolveAccessToken({
      accessTokenSha256: 'f'.repeat(64), now: '2026-10-15T00:02:00.000Z',
    })), null, 'reusing the rotated credential revokes its session family');

    const events = await database.selectFrom('identity_security_events').selectAll().execute();
    assert.ok(events.some((event) => event.event_code === 'SESSION_REFRESH_REUSE'));
    assert.ok(events.every((event) => !JSON.stringify(event.request_metadata).includes('refresh-token')));
    await assert.rejects(
      database.updateTable('identity_security_events').set({ outcome: 'SUCCESS' })
        .where('event_id', '=', events[0]!.event_id).execute(),
      /append-only/,
    );
    assert.equal(await database.selectFrom('auth_session_refresh_history').selectAll()
      .where('refresh_token_sha256', '=', 'b'.repeat(64)).executeTakeFirstOrThrow().then((row) => row.session_id), sessionId);

    let claims = {
      issuer: 'https://accounts.google.com', subject: 'google-session-registration',
      email: 'new.register@example.test', emailVerified: true, name: 'New owner',
      nonce: '', authTime: Math.floor(Date.now() / 1000), issuedAt: Math.floor(Date.now() / 1000),
    };
    const identity = new IdentitySessionService(transactions, { verify: async () => claims });
    const registrationChallenge = await identity.issueChallenge('REGISTER');
    claims = { ...claims, nonce: registrationChallenge.nonce };
    const registered = await identity.registerGoogle({ idToken: 'test-only-google-proof', nonce: registrationChallenge.nonce });
    const registeredUserId = googlePrincipalUserId(claims.issuer, claims.subject);
    assert.equal(registered.userId, registeredUserId);
    assert.equal(registered.tokenType, 'Bearer');
    assert.equal(registered.expiresInSeconds, 900);
    assert.equal(await database.selectFrom('user_emails').selectAll().where('user_id', '=', registeredUserId)
      .executeTakeFirstOrThrow().then((row) => row.verification_source), 'google');
    assert.equal(await database.selectFrom('organizations').selectAll()
      .where('primary_owner_user_id', '=', registeredUserId).executeTakeFirst(), undefined,
    'registration never creates or claims an Organization');
    assert.ok(await database.selectFrom('identity_security_events').selectAll()
      .where('user_id', '=', registeredUserId).where('event_code', '=', 'REGISTRATION_SUCCEEDED').executeTakeFirst());

    const loginChallenge = await identity.issueChallenge('LOGIN');
    claims = { ...claims, nonce: loginChallenge.nonce };
    const loginRequest = { idToken: 'test-only-google-proof', nonce: loginChallenge.nonce };
    const loggedIn = await identity.authenticateGoogle(loginRequest);
    assert.equal(loggedIn.userId, registeredUserId);
    await assert.rejects(identity.authenticateGoogle(loginRequest), UnauthorizedException,
      'the Google nonce cannot create a second session after replay');

    const unverifiedChallenge = await identity.issueChallenge('REGISTER');
    claims = { ...claims, subject: 'google-email-unverified', email: 'unverified@example.test',
      emailVerified: false, nonce: unverifiedChallenge.nonce };
    await assert.rejects(identity.registerGoogle({ idToken: 'test-only-google-proof', nonce: unverifiedChallenge.nonce }), UnauthorizedException);
    assert.equal(await database.selectFrom('users').selectAll()
      .where('user_id', '=', googlePrincipalUserId(claims.issuer, claims.subject)).executeTakeFirst(), undefined);

    const collisionChallenge = await identity.issueChallenge('REGISTER');
    claims = { ...claims, subject: 'google-email-collision', email: 'new.register@example.test',
      emailVerified: true, nonce: collisionChallenge.nonce, authTime: Math.floor(Date.now() / 1000) };
    await assert.rejects(identity.registerGoogle({ idToken: 'test-only-google-proof', nonce: collisionChallenge.nonce }), ServiceUnavailableException);
    assert.equal(await database.selectFrom('users').selectAll()
      .where('user_id', '=', googlePrincipalUserId(claims.issuer, claims.subject)).executeTakeFirst(), undefined,
    'email collision rolls back all candidate User rows');
  } finally {
    if (previousGate === undefined) delete process.env.TROOI_IDENTITY_FOUNDATION_RESOLUTION_ENABLED;
    else process.env.TROOI_IDENTITY_FOUNDATION_RESOLUTION_ENABLED = previousGate;
    await database.destroy();
  }
});
