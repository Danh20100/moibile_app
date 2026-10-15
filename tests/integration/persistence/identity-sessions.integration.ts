import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { sql } from 'kysely';

import { createDatabaseClient } from '../../../src/infrastructure/database/database.client';
import { PostgresTransactionManager } from '../../../src/infrastructure/database/postgres-transaction-manager';
import { createRepositorySet } from '../../../src/infrastructure/database/repositories/repository-set';
import { IdentitySessionService } from '../../../src/modules/identity-access/services/identity-session.service';
import { OrganizationService } from '../../../src/modules/organization/services/organization.service';
import { googlePrincipalUserId } from '../../../src/common/identity/deterministic-user-id';
import { UnauthorizedException, ServiceUnavailableException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '../../../src/common/guards/auth.guard';
import { GooglePrincipalResolver } from '../../../src/modules/identity-access/services/google-principal-resolver';
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
  const gatedIdentity = new IdentitySessionService(transactions, { verify: async () => { throw new Error('must not verify while gated'); } });
  for (const gate of [undefined, 'false']) {
    if (gate === undefined) delete process.env.TROOI_IDENTITY_FOUNDATION_RESOLUTION_ENABLED;
    else process.env.TROOI_IDENTITY_FOUNDATION_RESOLUTION_ENABLED = gate;
    await assert.rejects(gatedIdentity.issueChallenge('LOGIN'), ServiceUnavailableException);
    assert.equal(await database.selectFrom('identity_auth_challenges').select('challenge_id').execute().then((rows) => rows.length), 0);
    assert.equal(await database.selectFrom('identity_security_events').select('event_id').execute().then((rows) => rows.length), 0);
  }
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
    assert.equal(await transactions.run(({ repositories }) => repositories.identitySessions.resolveAccessToken({
      accessTokenSha256: 'a'.repeat(64), now: '2026-10-15T00:15:00.000Z',
    })), null, 'expired access tokens are rejected');
    assert.equal(await transactions.run(({ repositories }) => repositories.identitySessions.resolveAccessToken({
      accessTokenSha256: 'a'.repeat(64), now: '2026-11-14T00:00:00.000Z',
    })), null, 'idle-expired sessions are rejected');
    assert.equal(await transactions.run(({ repositories }) => repositories.identitySessions.resolveAccessToken({
      accessTokenSha256: 'a'.repeat(64), now: '2027-01-13T00:00:00.000Z',
    })), null, 'absolute-expired sessions are rejected');

    await sql`CREATE FUNCTION test_fail_session_created_audit() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.event_code = 'SESSION_CREATED' AND NEW.session_id = 'a6000000-0000-4000-8000-000000000004'::uuid THEN
          RAISE EXCEPTION 'injected audit insert failure';
        END IF;
        RETURN NEW;
      END
    $$`.execute(database);
    await sql`CREATE TRIGGER test_fail_session_created_audit BEFORE INSERT ON identity_security_events
      FOR EACH ROW EXECUTE FUNCTION test_fail_session_created_audit()`.execute(database);
    try {
      await assert.rejects(transactions.run(({ repositories }) => repositories.identitySessions.createSession({
        sessionId: 'a6000000-0000-4000-8000-000000000004', familyId: 'a6000000-0000-4000-8000-000000000004',
        userId, accessTokenSha256: '2'.repeat(64), accessExpiresAt: '2026-10-15T00:15:00.000Z',
        refreshTokenSha256: '3'.repeat(64), createdAt: now, idleExpiresAt: '2026-11-14T00:00:00.000Z',
        absoluteExpiresAt: '2027-01-13T00:00:00.000Z', authenticatedAt: now,
      })), /injected audit insert failure/);
      assert.equal(await database.selectFrom('auth_sessions').select('session_id')
        .where('session_id', '=', 'a6000000-0000-4000-8000-000000000004').executeTakeFirst(), undefined,
      'session insert rolls back when its audit event cannot be written');
    } finally {
      await sql`DROP TRIGGER test_fail_session_created_audit ON identity_security_events`.execute(database);
      await sql`DROP FUNCTION test_fail_session_created_audit()`.execute(database);
    }

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
    const sessionGuard = new AuthGuard(new Reflector(), new GooglePrincipalResolver(transactions));
    const protectedRequest = (token: string) => {
      const request: { headers: { authorization: string }; user?: { userId: string } } = {
        headers: { authorization: `Bearer ${token}` },
      };
      const context = {
        getHandler: () => ({}), getClass: () => ({}),
        switchToHttp: () => ({ getRequest: () => request }),
      } as unknown as ExecutionContext;
      return { context, request };
    };
    const authorizedRequest = protectedRequest(loggedIn.accessToken);
    assert.equal(await sessionGuard.canActivate(authorizedRequest.context), true);
    assert.equal(authorizedRequest.request.user?.userId, registeredUserId,
      'AuthGuard resolves the app session to the durable User');
    const reauthChallenge = await identity.issueOrganizationCreateReauthChallenge(registeredUserId, loggedIn.sessionId);
    claims = { ...claims, nonce: reauthChallenge.nonce, authTime: Math.floor(Date.now() / 1000) };
    const reauthProof = await identity.completeOrganizationCreateReauth(
      { idToken: 'test-only-google-proof', nonce: reauthChallenge.nonce }, registeredUserId, loggedIn.sessionId,
    );
    const organizations = new OrganizationService(transactions);
    const organization = await organizations.createWithReauthentication({ name: 'Authorized workspace',
      primaryOwnerUserId: registeredUserId, sessionId: loggedIn.sessionId, reauthProof: reauthProof.proof });
    assert.equal(organization.primaryOwnerUserId, registeredUserId);
    await assert.rejects(organizations.createWithReauthentication({ name: 'Replay',
      primaryOwnerUserId: registeredUserId, sessionId: loggedIn.sessionId, reauthProof: reauthProof.proof }), UnauthorizedException);
    assert.equal(await database.selectFrom('organizations').selectAll()
      .where('primary_owner_user_id', '=', registeredUserId).execute().then((rows) => rows.length), 1,
    'consumed operation proof cannot create a second Organization');
    assert.ok(await database.selectFrom('identity_security_events').selectAll().where('session_id', '=', loggedIn.sessionId)
      .where('event_code', '=', 'REAUTH_ISSUED').executeTakeFirst());
    const staleReauth = await identity.issueOrganizationCreateReauthChallenge(registeredUserId, loggedIn.sessionId);
    claims = { ...claims, nonce: staleReauth.nonce, authTime: Math.floor(Date.now() / 1000) - 600 };
    await assert.rejects(identity.completeOrganizationCreateReauth(
      { idToken: 'test-only-google-proof', nonce: staleReauth.nonce }, registeredUserId, loggedIn.sessionId,
    ), UnauthorizedException, 'stale Google authentication cannot mint an Organization proof');
    await assert.rejects(identity.authenticateGoogle(loginRequest), UnauthorizedException,
      'the Google nonce cannot create a second session after replay');
    assert.deepEqual(await identity.logout(loggedIn.accessToken), { revoked: true });
    assert.equal(await transactions.run(({ repositories }) => repositories.identitySessions.resolveAccessToken({
      accessTokenSha256: createHash('sha256').update(loggedIn.accessToken).digest('hex'), now: new Date().toISOString(),
    })), null, 'logout revokes access on the next request');
    await assert.rejects(sessionGuard.canActivate(protectedRequest(loggedIn.accessToken).context), UnauthorizedException,
      'AuthGuard rejects the logged-out session on the next protected request');
    const secondLoginChallenge = await identity.issueChallenge('LOGIN');
    claims = { ...claims, nonce: secondLoginChallenge.nonce, authTime: Math.floor(Date.now() / 1000) };
    const secondSession = await identity.authenticateGoogle({ idToken: 'test-only-google-proof', nonce: secondLoginChallenge.nonce });
    assert.equal((await identity.revokeAll(registeredUserId)).revokedSessionCount, 2,
      'revoke-all revokes remaining active sessions');
    assert.equal(await transactions.run(({ repositories }) => repositories.identitySessions.resolveAccessToken({
      accessTokenSha256: createHash('sha256').update(secondSession.accessToken).digest('hex'), now: new Date().toISOString(),
    })), null, 'revoke-all removes access for every active session');
    assert.equal(await transactions.run(({ repositories }) => repositories.identitySessions.resolveAccessToken({
      accessTokenSha256: createHash('sha256').update(registered.accessToken).digest('hex'), now: new Date().toISOString(),
    })), null, 'revoke-all also removes the registration session');
    await assert.rejects(sessionGuard.canActivate(protectedRequest(secondSession.accessToken).context), UnauthorizedException,
      'AuthGuard rejects sessions revoked by revoke-all');

    const auditFailureChallenge = await identity.issueChallenge('LOGIN');
    claims = { ...claims, nonce: auditFailureChallenge.nonce, authTime: Math.floor(Date.now() / 1000) };
    const auditFailureSession = await identity.authenticateGoogle({
      idToken: 'test-only-google-proof', nonce: auditFailureChallenge.nonce,
    });
    await sql`CREATE FUNCTION test_fail_session_revocation_audit() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.event_code IN ('SESSION_LOGOUT', 'SESSION_REVOKED') THEN
          RAISE EXCEPTION 'injected revocation audit insert failure';
        END IF;
        RETURN NEW;
      END
    $$`.execute(database);
    await sql`CREATE TRIGGER test_fail_session_revocation_audit BEFORE INSERT ON identity_security_events
      FOR EACH ROW EXECUTE FUNCTION test_fail_session_revocation_audit()`.execute(database);
    try {
      await assert.rejects(identity.logout(auditFailureSession.accessToken), /injected revocation audit insert failure/);
      await sessionGuard.canActivate(protectedRequest(auditFailureSession.accessToken).context);
      await assert.rejects(identity.revokeAll(registeredUserId), /injected revocation audit insert failure/);
      await sessionGuard.canActivate(protectedRequest(auditFailureSession.accessToken).context);
    } finally {
      await sql`DROP TRIGGER test_fail_session_revocation_audit ON identity_security_events`.execute(database);
      await sql`DROP FUNCTION test_fail_session_revocation_audit()`.execute(database);
    }

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
