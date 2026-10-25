import assert from 'node:assert/strict';
import { it } from 'node:test';
import { hash } from '@node-rs/argon2';
import { UnauthorizedException } from '@nestjs/common';
import { IdentitySessionService } from '../../src/modules/identity-access/services/identity-session.service';

const enabled = process.env.TROOI_IDENTITY_FOUNDATION_RESOLUTION_ENABLED;
process.env.TROOI_IDENTITY_FOUNDATION_RESOLUTION_ENABLED = 'true';

async function harness(
  options: { noUser?: boolean; withoutPassword?: boolean; stale?: boolean } = {},
) {
  const userId = 'b63e759d-3559-4e97-92ea-b40884f1c2b4';
  const encoded = await hash('correct-horse-password', {
    algorithm: 2,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  const snapshot = options.noUser
    ? null
    : {
        email: {
          userId,
          userEmailId: 'b328b954-7530-42bc-9eb3-43e62a0f88bf',
          emailRevision: '1',
          normalizedEmail: 'owner@example.com',
        },
        credential: options.withoutPassword
          ? null
          : {
              userId,
              passwordHash: encoded,
              credentialRevision: '1',
            },
      };
  const events: any[] = [];
  const sessions: any[] = [];
  const repositories = {
    identityFoundation: {
      findPrimaryLogin: async () => snapshot,
      validateLoginSnapshot: async (input: any) => {
        if (options.stale) throw new Error('stale credential');
        assert.equal(input.userId, userId);
        assert.equal(input.normalizedEmail, 'owner@example.com');
        assert.equal(input.credentialRevision, '1');
      },
    },
    identitySessions: {
      appendSecurityEvent: async (input: any) => events.push(input),
      createSession: async (input: any) => sessions.push(input),
    },
  };
  const service = new IdentitySessionService({
    run: async (fn: any) => fn({ repositories }),
  } as never);
  return { service, events, sessions };
}

it('password login issues a persisted opaque session for a verified Argon2id credential', async () => {
  const { service, sessions, events } = await harness();
  const result = await service.authenticatePassword({
    email: 'owner@EXAMPLE.COM',
    password: 'correct-horse-password',
  });
  assert.equal(result.userId, 'b63e759d-3559-4e97-92ea-b40884f1c2b4');
  assert.ok(result.accessToken.length > 20 && result.refreshToken.length > 20);
  assert.equal(sessions.length, 1);
  assert.equal(events.at(-1)?.requestMetadata?.purpose, 'PASSWORD_LOGIN');
  assert.equal(sessions[0].accessTokenSha256.length, 64);
  assert.equal(sessions[0].refreshTokenSha256.length, 64);
  assert.notEqual(sessions[0].accessTokenSha256, result.accessToken);
});

it('incorrect and absent credentials never issue sessions or reveal account existence', async () => {
  for (const input of [
    { opts: {}, email: 'owner@example.com', password: 'incorrect-password' },
    { opts: { noUser: true }, email: 'missing@example.com', password: 'incorrect-password' },
    { opts: { withoutPassword: true }, email: 'owner@example.com', password: 'incorrect-password' },
    { opts: {}, email: 'not-an-email', password: 'incorrect-password' },
  ]) {
    const { service, sessions } = await harness(input.opts);
    await assert.rejects(
      service.authenticatePassword({ email: input.email, password: input.password }),
      (error: unknown) =>
        error instanceof UnauthorizedException &&
        error.message === 'Email or password is incorrect',
    );
    assert.equal(sessions.length, 0);
  }
});

it('rejects stale password revision before persisting session', async () => {
  const { service, sessions } = await harness({ stale: true });
  await assert.rejects(
    service.authenticatePassword({
      email: 'owner@example.com',
      password: 'correct-horse-password',
    }),
    UnauthorizedException,
  );
  assert.equal(sessions.length, 0);
});

it('Google/local demo are not used as fallback credentials', async () => {
  const { service, sessions } = await harness({ withoutPassword: true });
  await assert.rejects(
    service.authenticatePassword({
      email: 'owner@example.com',
      password: 'the-old-local-demo-password',
    }),
    UnauthorizedException,
  );
  assert.equal(sessions.length, 0);
});

process.on('exit', () => {
  if (enabled === undefined) delete process.env.TROOI_IDENTITY_FOUNDATION_RESOLUTION_ENABLED;
  else process.env.TROOI_IDENTITY_FOUNDATION_RESOLUTION_ENABLED = enabled;
});
