import assert from 'node:assert/strict';
import test from 'node:test';
import { ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { EmailOtpService } from '../../src/modules/identity-access/services/email-otp.service';

async function harness(passwordConfigured = true) {
  let email: any = {
    userId: 'user-1', userEmailId: 'email-1', address: 'old@example.com', normalizedEmail: 'old@example.com',
    emailRevision: '4', verifiedAt: '2026-10-01T00:00:00.000Z', verificationSource: 'google',
  };
  let credential = { userId: 'user-1', passwordHash: '$argon2id$stub', credentialRevision: '2' };
  let otherOwner: any = null;
  let challenge: any = null;
  const events: any[] = [];
  const mails: any[] = [];
  const revokedUsers: string[] = [];
  const repositories: any = {
    identityFoundation: {
      findPrimaryLoginByUserId: async (userId: string) => userId === 'user-1' ? { email: { ...email }, credential: passwordConfigured ? { ...credential } : null } : null,
      findPrimaryLogin: async (normalized: string) => normalized === email.normalizedEmail && passwordConfigured
        ? { email: { ...email }, credential: { ...credential } } : null,
      validateProofSnapshot: async (expected: any) => {
        if (expected.userId !== email.userId || expected.userEmailId !== email.userEmailId ||
            expected.emailRevision !== email.emailRevision || expected.credentialRevision !== credential.credentialRevision)
          throw new Error('stale proof snapshot');
      },
      replacePasswordCredential: async (input: any) => {
        if (input.expectedRevision !== credential.credentialRevision) throw new Error('stale credential revision');
        credential = { ...credential, passwordHash: input.encodedHash, credentialRevision: String(Number(credential.credentialRevision) + 1) };
      },
      lockMailbox: async () => {},
      findMailboxOwner: async (normalized: string) => {
        const canonical = (value: string) => /@(gmail\.com|googlemail\.com)$/.test(value)
          ? `${value.split('@')[0]!.split('+')[0]!.replaceAll('.', '')}@gmail.com`
          : value;
        if (otherOwner && canonical(normalized) === canonical(otherOwner.normalizedEmail)) return otherOwner;
        return canonical(normalized) === canonical(email.normalizedEmail) ? {
          userId: email.userId, normalizedEmail: email.normalizedEmail, verificationSource: email.verificationSource,
          hasGoogleIdentity: true, hasPassword: passwordConfigured,
        } : null;
      },
      replacePrimaryEmail: async (input: any) => {
        if (input.expectedEmailId !== email.userEmailId || input.expectedEmailRevision !== email.emailRevision)
          throw new Error('stale email revision');
        email = { ...email, ...input.target, emailRevision: String(Number(email.emailRevision) + 1) };
        return { ...email };
      },
    },
    identityOtp: {
      deleteSettledBefore: async () => {},
      findLatestByMailbox: async () => null,
      createChallenge: async (input: any) => {
        challenge = { ...input, attempts: 0, maxAttempts: 5, lastSentAt: input.createdAt, consumedAt: null, supersededAt: null };
        return challenge;
      },
      findLiveById: async (id: string) => challenge?.challengeId === id && !challenge.consumedAt && !challenge.supersededAt ? challenge : null,
      recordFailedAttempt: async () => ++challenge.attempts,
      consume: async ({ challengeId, now }: any) => {
        if (!challenge || challenge.challengeId !== challengeId || challenge.consumedAt || challenge.supersededAt) return false;
        challenge.consumedAt = now;
        return true;
      },
      supersedeById: async ({ challengeId, now }: any) => { if (challenge?.challengeId === challengeId) challenge.supersededAt = now; },
      supersedeLiveByMailbox: async () => {},
    },
    identitySessions: {
      appendSecurityEvent: async (event: any) => { events.push(event); },
      revokeAll: async ({ userId }: any) => { revokedUsers.push(userId); return 1; },
    },
  };
  const service = new EmailOtpService(
    { run: (work: any) => work({ repositories }) } as any,
    { send: async (message: any) => { mails.push(message); } },
    { enabled: true, otpHmacSecret: 'test-secret-that-is-long-enough-for-the-test', smtp: {} as any },
  );
  const issue = async (targetEmail = 'new@example.com') => {
    const response = await service.requestEmailChange({ email: targetEmail }, 'user-1', 'session-1');
    const code = mails.at(-1).text.match(/\b\d{6}\b/)?.[0];
    assert.ok(code);
    return { response, code };
  };
  return { service, issue, events, mails, revokedUsers, get challenge() { return challenge; }, get email() { return email; }, set email(value: any) { email = value; }, set otherOwner(value: any) { otherOwner = value; } };
}

test('email change requires a password-enabled own account, sends OTP, updates only its verified email and audits', async () => {
  const h = await harness();
  const { response, code } = await h.issue();
  assert.equal(h.mails[0].to, 'new@example.com');
  assert.match(h.mails[0].subject, /xác minh email đăng nhập/i);
  assert.equal(h.challenge.purpose, 'EMAIL_CHANGE');
  assert.equal(h.challenge.changeUserId, 'user-1');
  assert.equal(h.challenge.changeSessionId, 'session-1');
  assert.equal(h.challenge.changeEmailRevision, '4');
  assert.equal((await h.service.verifyEmailChange({ otpChallengeId: response.otpChallengeId, code }, 'user-1', 'session-1')).email, 'new@example.com');
  assert.equal(h.email.address, 'new@example.com');
  assert.equal(h.email.verificationSource, 'email_otp');
  assert.deepEqual(h.events.filter(event => event.eventCode === 'EMAIL_CHANGED').map(event => event.userId), ['user-1']);
  await assert.rejects(h.service.verifyEmailChange({ otpChallengeId: response.otpChallengeId, code }, 'user-1', 'session-1'), UnauthorizedException);
  assert.equal(h.email.emailRevision, '5');
});

test('email change rejects an owned canonical mailbox without sending OTP', async () => {
  const h = await harness();
  h.otherOwner = { userId: 'user-2', normalizedEmail: 'ab@gmail.com' };
  await assert.rejects(h.service.requestEmailChange({ email: 'a.b+alias@gmail.com' }, 'user-1', 'session-1'), ConflictException);
  assert.equal(h.mails.length, 0);
});

test('email OTP is bound to the issuing user and session and cannot be replayed in a race', async () => {
  const h = await harness();
  const { response, code } = await h.issue();
  await assert.rejects(h.service.verifyEmailChange({ otpChallengeId: response.otpChallengeId, code }, 'user-1', 'other-session'), UnauthorizedException);
  assert.equal(h.email.address, 'old@example.com');

  const retry = await harness();
  const issued = await retry.issue();
  const results = await Promise.allSettled([
    retry.service.verifyEmailChange({ otpChallengeId: issued.response.otpChallengeId, code: issued.code }, 'user-1', 'session-1'),
    retry.service.verifyEmailChange({ otpChallengeId: issued.response.otpChallengeId, code: issued.code }, 'user-1', 'session-1'),
  ]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(retry.events.filter(event => event.eventCode === 'EMAIL_CHANGED').length, 1);
});

test('email change rejects stale email snapshots and leaves the latest address untouched', async () => {
  const h = await harness();
  const { response, code } = await h.issue();
  h.email = { ...h.email, address: 'changed-elsewhere@example.com', normalizedEmail: 'changed-elsewhere@example.com', emailRevision: '5' };
  await assert.rejects(h.service.verifyEmailChange({ otpChallengeId: response.otpChallengeId, code }, 'user-1', 'session-1'), UnauthorizedException);
  assert.equal(h.email.address, 'changed-elsewhere@example.com');
});

test('Google-only account cannot change login email before setting a password', async () => {
  const h = await harness(false);
  await assert.rejects(h.issue(), ForbiddenException);
  assert.equal(h.mails.length, 0);
});

test('password reset OTP works for the newly configured credential and revokes sessions after replacement', async () => {
  const h = await harness();
  const issued = await h.service.requestPasswordReset({ email: 'old@example.com' });
  const code = h.mails.at(-1).text.match(/\b\d{6}\b/)?.[0];
  assert.ok(code);
  assert.equal(h.mails.at(-1).to, 'old@example.com');
  assert.deepEqual(await h.service.verifyPasswordReset({
    otpChallengeId: issued.otpChallengeId, code, password: 'reset-password-123',
  }), { reset: true });
  assert.deepEqual(h.revokedUsers, ['user-1']);
  await assert.rejects(h.service.verifyPasswordReset({
    otpChallengeId: issued.otpChallengeId, code, password: 'another-password-123',
  }), UnauthorizedException);
});

test('password reset request does not disclose an unknown email through delivery behavior', async () => {
  const h = await harness();
  const issued = await h.service.requestPasswordReset({ email: 'unknown@example.com' });
  assert.ok(issued.otpChallengeId);
  assert.equal(h.mails.length, 0);
});
