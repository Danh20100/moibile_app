import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { it } from 'node:test';
import { hash, verify } from '@node-rs/argon2';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { IdentitySessionService } from '../../src/modules/identity-access/services/identity-session.service';
import { IdentityFoundationConflict } from '../../src/persistence/ports/identity-foundation.repository';

const previousGate = process.env.TROOI_IDENTITY_FOUNDATION_RESOLUTION_ENABLED;
process.env.TROOI_IDENTITY_FOUNDATION_RESOLUTION_ENABLED = 'true';
const userId = 'b63e759d-3559-4e97-92ea-b40884f1c2b4';
const sessionId = 'd63e759d-3559-4e97-92ea-b40884f1c2b5';
const googleSubject = 'bound-google-subject';

async function harness() {
  const challenges = new Map<string, {
    challengeId: string; purpose: string; nonceSha256: string; userId: string | null;
    sessionId: string | null; expiresAt: string; consumedAt: string | null;
  }>();
  const credentials = new Map<string, { passwordHash: string }>();
  const events: Array<Record<string, any>> = [];
  const sessions: Array<Record<string, any>> = [];
  const identities = new Map<string, { issuer: string; subject: string; nonce: string; authTime?: number; issuedAt?: number }>();
  let tail = Promise.resolve();
  const repositories = {
    identitySessions: {
      createChallenge: async (input: any) => {
        challenges.set(input.nonceSha256, { ...input, consumedAt: null });
      },
      consumeChallenge: async (input: any) => {
        const row = challenges.get(input.nonceSha256);
        if (!row || row.purpose !== input.purpose || row.consumedAt || Date.parse(row.expiresAt) <= Date.parse(input.now) ||
            (input.userId !== undefined && row.userId !== input.userId) ||
            (input.sessionId !== undefined && row.sessionId !== input.sessionId)) return null;
        row.consumedAt = input.now;
        return { challengeId: row.challengeId, userId: row.userId, sessionId: row.sessionId };
      },
      appendSecurityEvent: async (event: Record<string, any>) => { events.push(event); },
      createSession: async (session: Record<string, any>) => { sessions.push(session); },
    },
    identityFoundation: {
      resolveGooglePrincipal: async (principal: { issuer: string; subject: string }) =>
        principal.subject === googleSubject
          ? { kind: 'resolved' as const, userId }
          : { kind: 'unregistered' as const },
      insertPasswordCredential: async (input: { userId: string; encodedHash: string }) => {
        if (input.userId !== userId) throw new Error('wrong user id');
        if (credentials.has(input.userId)) throw new IdentityFoundationConflict('credential_exists');
        credentials.set(input.userId, { passwordHash: input.encodedHash });
        return { userId: input.userId, passwordHash: input.encodedHash };
      },
      findPrimaryLogin: async () => {
        const credential = credentials.get(userId);
        return credential ? {
          email: { userId, userEmailId: 'b328b954-7530-42bc-9eb3-43e62a0f88bf', emailRevision: '1',
            normalizedEmail: 'owner@example.com', address: 'owner@example.com', verifiedAt: new Date().toISOString(),
            verificationSource: 'google' as const },
          credential: { userId, ...credential, credentialRevision: '1' },
        } : null;
      },
      validateLoginSnapshot: async () => {},
    },
  };
  const transactions = {
    run: async (work: (context: any) => Promise<unknown>) => {
      const previous = tail;
      let release!: () => void;
      tail = new Promise<void>((resolve) => { release = resolve; });
      await previous;
      const challengeSnapshot = new Map([...challenges].map(([key, value]) => [key, { ...value }]));
      const credentialSnapshot = new Map(credentials);
      const eventCount = events.length;
      try {
        return await work({ repositories, afterCommit: () => {} });
      } catch (error) {
        challenges.clear();
        for (const [key, value] of challengeSnapshot) challenges.set(key, value);
        credentials.clear();
        for (const [key, value] of credentialSnapshot) credentials.set(key, value);
        events.splice(eventCount);
        throw error;
      } finally {
        release();
      }
    },
  };
  const service = new IdentitySessionService(transactions as never, {
    verify: async (idToken: string) => {
      const identity = identities.get(idToken);
      if (!identity) throw new Error('unknown test token');
      return identity;
    },
  });
  const setup = async (password: string, subject = googleSubject, authTime = Math.floor(Date.now() / 1000), nonce?: string) => {
    const challenge = await service.issueInitialPasswordSetupChallenge(userId, sessionId);
    const idToken = randomUUID();
    identities.set(idToken, {
      issuer: 'https://accounts.google.com', subject, nonce: nonce ?? challenge.nonce, authTime,
    });
    return {
      challenge,
      idToken,
      result: () => service.setInitialPassword({ idToken, nonce: challenge.nonce, password }, userId, sessionId),
    };
  };
  const setupWithIssuedAt = async (issuedAt: number, authTime?: number) => {
    const attempt = await setup('first-password-123');
    const identity = identities.get(attempt.idToken)!;
    if (authTime === undefined) delete identity.authTime;
    else identity.authTime = authTime;
    identity.issuedAt = issuedAt;
    return attempt;
  };
  return { service, setup, setupWithIssuedAt, challenges, credentials, events, identities, sessions };
}

it('sets a Google-only account password once with a fresh bound nonce and audits the Argon2id credential', async () => {
  const h = await harness();
  const attempt = await h.setup('first-password-123');
  assert.deepEqual(await attempt.result(), { configured: true });
  const credential = h.credentials.get(userId);
  assert.ok(credential?.passwordHash.startsWith('$argon2id$'));
  assert.ok(await verify(credential!.passwordHash, 'first-password-123'));
  assert.equal(h.events.filter((event) => event.eventCode === 'PASSWORD_INITIALIZED').length, 1);
  assert.deepEqual(h.events.find((event) => event.eventCode === 'PASSWORD_INITIALIZED')?.requestMetadata, {
    method: 'google', operation: 'password.initial_setup',
  });
  assert.ok(!JSON.stringify(h.events).includes('first-password-123'));
  const passwordSession = await h.service.authenticatePassword({ email: 'owner@example.com', password: 'first-password-123' });
  assert.equal(passwordSession.userId, userId);
  assert.equal(h.sessions.length, 1);
  await assert.rejects(attempt.result(), ForbiddenException, 'a consumed setup nonce cannot be replayed');
  assert.ok(await verify(h.credentials.get(userId)!.passwordHash, 'first-password-123'));
});

it('rejects another Google principal and stale or mismatched Google authentication without creating a credential', async () => {
  const h = await harness();
  const otherPrincipal = await h.setup('first-password-123', 'different-google-subject');
  await assert.rejects(otherPrincipal.result(), ForbiddenException);
  assert.equal(h.credentials.has(userId), false);

  const stale = await h.setup('first-password-123', googleSubject, Math.floor(Date.now() / 1000) - 600);
  await assert.rejects(stale.result(), ForbiddenException);
  const wrongNonce = await h.setup('first-password-123', googleSubject, Math.floor(Date.now() / 1000), 'not-the-challenge-nonce');
  await assert.rejects(wrongNonce.result(), ForbiddenException);
  assert.equal(h.credentials.has(userId), false);
  assert.equal(h.events.filter((event) => event.eventCode === 'PASSWORD_INITIALIZED').length, 0);
  assert.equal(h.events.filter((event) => event.eventCode === 'REAUTH_REJECTED').length, 3);
});

it('supports a fresh nonce-bound Google token without optional auth_time, rejects stale signed issuance', async () => {
  const recent = await harness();
  const fresh = await recent.setupWithIssuedAt(Math.floor(Date.now() / 1000));
  assert.deepEqual(await fresh.result(), { configured: true });
  const stale = await harness();
  const expired = await stale.setupWithIssuedAt(Math.floor(Date.now() / 1000) - 600);
  await assert.rejects(expired.result(), ForbiddenException);
  const missing = await harness();
  const lacking = await missing.setup('first-password-123');
  const identity = missing.identities.get(lacking.idToken)!;
  delete identity.authTime;
  await assert.rejects(lacking.result(), ForbiddenException);
});

it('does not overwrite an existing password credential', async () => {
  const h = await harness();
  const existingHash = await hash('existing-password-123', { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  h.credentials.set(userId, { passwordHash: existingHash });
  const attempt = await h.setup('replacement-password-123');
  await assert.rejects(attempt.result(), ConflictException);
  assert.ok(await verify(h.credentials.get(userId)!.passwordHash, 'existing-password-123'));
  assert.ok(!await verify(h.credentials.get(userId)!.passwordHash, 'replacement-password-123'));
});

it('serializes competing initial setup requests so only one credential can be created', async () => {
  const h = await harness();
  const first = await h.setup('first-password-123');
  const second = await h.setup('second-password-123');
  const outcomes = await Promise.allSettled([first.result(), second.result()]);
  assert.equal(outcomes.filter((outcome) => outcome.status === 'fulfilled').length, 1);
  assert.equal(outcomes.filter((outcome) => outcome.status === 'rejected' && outcome.reason instanceof ConflictException).length, 1);
  const stored = h.credentials.get(userId)!.passwordHash;
  assert.equal(await verify(stored, 'first-password-123') || await verify(stored, 'second-password-123'), true);
  assert.equal(h.events.filter((event) => event.eventCode === 'PASSWORD_INITIALIZED').length, 1);
});

process.on('exit', () => {
  if (previousGate === undefined) delete process.env.TROOI_IDENTITY_FOUNDATION_RESOLUTION_ENABLED;
  else process.env.TROOI_IDENTITY_FOUNDATION_RESOLUTION_ENABLED = previousGate;
});
