import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { ConflictException, ForbiddenException, HttpException, HttpStatus, Inject, Injectable, OnModuleInit, Optional, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { sql, type Kysely } from 'kysely';
import { DATABASE_CLIENT } from '../../../infrastructure/database/database.tokens';
import type { Database } from '../../../infrastructure/database/schema.types';
import { hash as hashArgon2, verify as verifyArgon2 } from '@node-rs/argon2';

import { normalizeLoginEmail } from '../../../common/identity/normalize-login-email';
import { verifyGoogleIdToken } from '../../../integrations/google-identity/verify-token';
import { GOOGLE_ID_TOKEN_VERIFIER, type GoogleIdTokenVerifier } from '../../../integrations/google-identity';
import { TRANSACTION_MANAGER, type TransactionManager } from '../../../persistence/ports/transaction-manager';
import { IdentityFoundationConflict } from '../../../persistence/ports/identity-foundation.repository';
import { ensureResetTestUser, resetTestEmail } from './reset-test-user';

const ACCESS_LIFETIME_MS = 15 * 60 * 1000;
const IDLE_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
const ABSOLUTE_LIFETIME_MS = 90 * 24 * 60 * 60 * 1000;
const CHALLENGE_LIFETIME_MS = 5 * 60 * 1000;
const MAX_AUTH_AGE_MS = 5 * 60 * 1000;

export interface IdentityAuthChallenge {
  purpose: 'LOGIN' | 'REGISTER';
  nonce: string;
  expiresAt: string;
}

export interface IdentitySessionResponse {
  userId: string;
  sessionId: string;
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresInSeconds: 900;
  refreshExpiresAt: string;
}

export interface OrganizationCreateReauthChallenge { nonce: string; expiresAt: string }
export interface OrganizationCreateReauthProof { proof: string; expiresAt: string }
export interface InitialPasswordSetupChallenge { nonce: string; expiresAt: string }

@Injectable()
export class IdentitySessionService implements OnModuleInit {
  constructor(
    @Inject(TRANSACTION_MANAGER) private readonly transactions: TransactionManager,
    @Optional() @Inject(GOOGLE_ID_TOKEN_VERIFIER) private readonly verifier?: GoogleIdTokenVerifier,
    @Optional() @Inject(DATABASE_CLIENT) private readonly database?: Kysely<Database>,
  ) {}

  async onModuleInit(): Promise<void> {
    await ensureResetTestUser(this.transactions, process.env);
  }

  async issueChallenge(purpose: 'LOGIN' | 'REGISTER'): Promise<IdentityAuthChallenge> {
    this.requireEnabled();
    const now = new Date();
    const nonce = randomBytes(32).toString('base64url');
    const expiresAt = new Date(now.getTime() + CHALLENGE_LIFETIME_MS).toISOString();
    await this.transactions.run(async ({ repositories }) => {
      await repositories.identitySessions.createChallenge({
        challengeId: randomUUID(), purpose, nonceSha256: digest(nonce), userId: null, sessionId: null,
        createdAt: now.toISOString(), expiresAt,
      });
      await repositories.identitySessions.appendSecurityEvent({
        eventId: randomUUID(), userId: null, sessionId: null, eventCode: 'CHALLENGE_ISSUED',
        outcome: 'SUCCESS', occurredAt: now.toISOString(), requestMetadata: { purpose },
      });
    });
    return { purpose, nonce, expiresAt };
  }

  async issueOrganizationCreateReauthChallenge(userId: string, sessionId: string): Promise<OrganizationCreateReauthChallenge> {
    this.requireEnabled();
    if (!userId || !sessionId) throw new UnauthorizedException('An application session is required');
    const now = new Date();
    const nonce = randomBytes(32).toString('base64url');
    const expiresAt = new Date(now.getTime() + CHALLENGE_LIFETIME_MS).toISOString();
    await this.transactions.run(async ({ repositories }) => {
      await repositories.identitySessions.createChallenge({ challengeId: randomUUID(),
        purpose: 'REAUTH_ORGANIZATION_CREATE', nonceSha256: digest(nonce), userId, sessionId,
        createdAt: now.toISOString(), expiresAt });
      await repositories.identitySessions.appendSecurityEvent({ eventId: randomUUID(), userId, sessionId,
        eventCode: 'REAUTH_ISSUED', outcome: 'SUCCESS', occurredAt: now.toISOString(),
        requestMetadata: { phase: 'challenge' } });
    });
    return { nonce, expiresAt };
  }

  async issueInitialPasswordSetupChallenge(userId: string, sessionId: string): Promise<InitialPasswordSetupChallenge> {
    this.requireEnabled();
    if (!userId || !sessionId) throw new UnauthorizedException('An application session is required');
    const now = new Date();
    const nonce = randomBytes(32).toString('base64url');
    const expiresAt = new Date(now.getTime() + CHALLENGE_LIFETIME_MS).toISOString();
    await this.transactions.run(async ({ repositories }) => {
      await repositories.identitySessions.createChallenge({
        challengeId: randomUUID(), purpose: 'INITIAL_PASSWORD_SETUP', nonceSha256: digest(nonce),
        userId, sessionId, createdAt: now.toISOString(), expiresAt,
      });
      await repositories.identitySessions.appendSecurityEvent({
        eventId: randomUUID(), userId, sessionId, eventCode: 'REAUTH_ISSUED', outcome: 'SUCCESS',
        occurredAt: now.toISOString(), requestMetadata: { operation: 'password.initial_setup', phase: 'challenge' },
      });
    });
    return { nonce, expiresAt };
  }

  async setInitialPassword(
    input: { idToken: string; nonce: string; password: string }, userId: string, sessionId: string,
  ): Promise<{ configured: boolean }> {
    this.requireEnabled();
    if (!userId || !sessionId) throw new UnauthorizedException('An application session is required');
    if (input.password.length < 8 || input.password.length > 128)
      throw new ForbiddenException('Invalid initial password');

    let identity: Awaited<ReturnType<typeof verifyGoogleIdToken>>;
    try {
      identity = await verifyGoogleIdToken(this.verifier, input.idToken);
    } catch {
      await this.recordInitialPasswordSetupRejected(userId, sessionId, 'google_token_invalid');
      throw new ForbiddenException('Google reauthentication was rejected');
    }
    if (!this.matchesFreshNonce(input.nonce, identity.nonce) || !this.isRecentGoogleSetupProof(identity.authTime, identity.issuedAt)) {
      await this.recordInitialPasswordSetupRejected(userId, sessionId, 'google_auth_stale_or_nonce_invalid');
      throw new ForbiddenException('Fresh Google authentication is required');
    }

    const now = new Date().toISOString();
    const encodedHash = await hashArgon2(input.password, {
      algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1,
    });
    try {
      const configured = await this.transactions.run(async ({ repositories }) => {
        const challenge = await repositories.identitySessions.consumeChallenge({
          nonceSha256: digest(input.nonce), purpose: 'INITIAL_PASSWORD_SETUP', now, userId, sessionId,
        });
        if (!challenge || challenge.userId !== userId || challenge.sessionId !== sessionId) return false;

        const principal = {
          issuer: identity.issuer as 'accounts.google.com' | 'https://accounts.google.com',
          subject: identity.subject,
        };
        const binding = await repositories.identityFoundation.resolveGooglePrincipal(principal);
        if (binding.kind !== 'resolved' || binding.userId !== userId) return false;

        await repositories.identityFoundation.insertPasswordCredential({ userId, encodedHash, now });
        await repositories.identitySessions.appendSecurityEvent({
          eventId: randomUUID(), userId, sessionId, eventCode: 'PASSWORD_INITIALIZED', outcome: 'SUCCESS',
          occurredAt: now, requestMetadata: { method: 'google', operation: 'password.initial_setup' },
        });
        return true;
      });
      if (!configured) {
        await this.recordInitialPasswordSetupRejected(userId, sessionId, 'challenge_or_principal_scope_invalid');
        throw new ForbiddenException('Google reauthentication was rejected');
      }
      return { configured: true };
    } catch (error) {
      if (error instanceof IdentityFoundationConflict) {
        await this.recordInitialPasswordSetupRejected(userId, sessionId, error.code);
        if (error.code === 'credential_exists') throw new ConflictException('Password is already configured');
        throw new ForbiddenException('Google reauthentication was rejected');
      }
      throw error;
    }
  }

  async completeOrganizationCreateReauth(input: { idToken: string; nonce: string }, userId: string, sessionId: string): Promise<OrganizationCreateReauthProof> {
    this.requireEnabled();
    let identity: Awaited<ReturnType<typeof verifyGoogleIdToken>>;
    try { identity = await verifyGoogleIdToken(this.verifier, input.idToken); }
    catch { await this.recordReauthRejected(userId, sessionId, 'proof_invalid'); throw new ForbiddenException('Reauthentication was rejected'); }
    if (!this.matchesFreshNonce(input.nonce, identity.nonce) || !this.isRecentAuth(identity.authTime)) {
      await this.recordReauthRejected(userId, sessionId, 'proof_stale_or_nonce_invalid');
      throw new ForbiddenException('Fresh Google authentication is required');
    }
    const proof = randomBytes(32).toString('base64url');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + CHALLENGE_LIFETIME_MS).toISOString();
    const issued = await this.transactions.run(async ({ repositories }) => {
      const principal = { issuer: identity.issuer as 'accounts.google.com' | 'https://accounts.google.com', subject: identity.subject };
      const binding = await repositories.identityFoundation.resolveGooglePrincipal(principal);
      if (binding.kind !== 'resolved' || binding.userId !== userId) return false;
      const challenge = await repositories.identitySessions.consumeChallenge({ nonceSha256: digest(input.nonce),
        purpose: 'REAUTH_ORGANIZATION_CREATE', now: now.toISOString(), userId, sessionId });
      if (!challenge || challenge.userId !== userId || challenge.sessionId !== sessionId) return false;
      await repositories.identitySessions.createChallenge({ challengeId: randomUUID(),
        purpose: 'REAUTH_ORGANIZATION_CREATE', nonceSha256: digest(proof), userId, sessionId,
        createdAt: now.toISOString(), expiresAt });
      await repositories.identitySessions.appendSecurityEvent({ eventId: randomUUID(), userId, sessionId,
        eventCode: 'REAUTH_ISSUED', outcome: 'SUCCESS', occurredAt: now.toISOString(),
        requestMetadata: { phase: 'operation_proof', operation: 'organization.create' } });
      return true;
    });
    if (!issued) {
      await this.recordReauthRejected(userId, sessionId, 'challenge_scope_invalid');
      throw new ForbiddenException('Reauthentication challenge is invalid or expired');
    }
    return { proof, expiresAt };
  }

  /**
   * Reauthenticate using the current session's verified password credential.
   * The nonce and resulting one-use proof are both bound to this session and operation.
   * A rejected password MUST NOT revoke or reclassify an otherwise valid session.
   */
  async completeOrganizationCreatePasswordReauth(
    input: { nonce: string; password: string }, userId: string, sessionId: string,
  ): Promise<OrganizationCreateReauthProof> {
    this.requireEnabled();
    if (!userId || !sessionId || !this.database) {
      throw new UnauthorizedException('Application session is required');
    }
    if ((await this.securityPinStatus(userId)).pinConfigured) {
      throw new ForbiddenException('Security PIN confirmation is required');
    }
    const recent = await sql<{ attempts: number }>`
      SELECT count(*)::integer AS attempts FROM identity_security_events
      WHERE user_id = ${userId}::uuid
        AND event_code = 'REAUTH_REJECTED'
        AND occurred_at >= now() - interval '15 minutes'
        AND request_metadata->>'method' = 'password'
    `.execute(this.database);
    if ((recent.rows[0]?.attempts ?? 0) >= 5) {
      throw new HttpException('Too many password confirmations. Try again later.', HttpStatus.TOO_MANY_REQUESTS);
    }
    const email = await this.database.selectFrom('user_emails')
      .select(['normalized_email'])
      .where('user_id', '=', userId)
      .executeTakeFirst();
    const snapshot = email ? await this.transactions.run(({ repositories }) =>
      repositories.identityFoundation.findPrimaryLogin(email.normalized_email),
    ) : null;
    let valid = false;
    if (snapshot?.email.userId === userId && snapshot.credential?.passwordHash && input.password) {
      try { valid = await verifyArgon2(snapshot.credential.passwordHash, input.password); }
      catch { valid = false; }
    }
    if (!valid || !snapshot?.credential) {
      await this.recordPasswordReauthRejected(userId, sessionId);
      throw new ForbiddenException('Incorrect password');
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + CHALLENGE_LIFETIME_MS).toISOString();
    const proof = randomBytes(32).toString('base64url');
    const issued = await this.transactions.run(async ({ repositories }) => {
      await repositories.identityFoundation.validateLoginSnapshot({
        userId, userEmailId: snapshot.email.userEmailId,
        emailRevision: snapshot.email.emailRevision,
        normalizedEmail: snapshot.email.normalizedEmail,
        credentialRevision: snapshot.credential!.credentialRevision,
      });
      const challenge = await repositories.identitySessions.consumeChallenge({
        nonceSha256: digest(input.nonce),
        purpose: 'REAUTH_ORGANIZATION_CREATE',
        now: now.toISOString(),
        userId,
        sessionId,
      });
      if (!challenge || challenge.userId !== userId || challenge.sessionId !== sessionId) return false;
      await repositories.identitySessions.createChallenge({
        challengeId: randomUUID(), purpose: 'REAUTH_ORGANIZATION_CREATE',
        nonceSha256: digest(proof), userId, sessionId,
        createdAt: now.toISOString(), expiresAt,
      });
      await repositories.identitySessions.appendSecurityEvent({
        eventId: randomUUID(), userId, sessionId, eventCode: 'REAUTH_ISSUED',
        outcome: 'SUCCESS', occurredAt: now.toISOString(),
        requestMetadata: { phase: 'operation_proof', operation: 'organization.create', method: 'password' },
      });
      return true;
    }).catch(() => false);
    if (!issued) {
      await this.recordPasswordReauthRejected(userId, sessionId);
      throw new ForbiddenException('Reauthentication challenge expired or invalid');
    }
    return { proof, expiresAt };
  }

  private async recordPasswordReauthRejected(userId: string, sessionId: string, method: 'password' | 'pin' = 'password'): Promise<void> {
    const now = new Date().toISOString();
    await this.transactions.run(({ repositories }) => repositories.identitySessions.appendSecurityEvent({
      eventId: randomUUID(), userId, sessionId,
      eventCode: 'REAUTH_REJECTED', outcome: 'REJECTED',
      occurredAt: now, requestMetadata: { method, reason: 'invalid_confirmation' },
    }));
  }

  async securityPinStatus(userId: string): Promise<{ pinConfigured: boolean }> {
    this.requireEnabled();
    if (!this.database || !userId) throw new UnauthorizedException('Application session required');
    const record = await sql`SELECT 1 FROM identity_security_pins WHERE user_id=${userId}::uuid`.execute(this.database);
    return { pinConfigured: record.rows.length > 0 };
  }

  async configureSecurityPin(
    input: { password: string; pin: string }, userId: string, sessionId: string,
  ): Promise<{ pinConfigured: boolean }> {
    this.requireEnabled();
    if (!this.database || !userId || !sessionId) throw new UnauthorizedException('Application session required');
    if (!/^[0-9]{6}$/.test(input.pin)) throw new ForbiddenException('Invalid security PIN');
    await this.enforceReauthLimit(userId, 'password');
    const email = await this.database.selectFrom('user_emails').select('normalized_email')
      .where('user_id', '=', userId).executeTakeFirst();
    const snapshot = email ? await this.transactions.run(({ repositories }) =>
      repositories.identityFoundation.findPrimaryLogin(email.normalized_email)) : null;
    const credential = snapshot?.credential;
    let verified = false;
    if (snapshot?.email.userId === userId && credential?.passwordHash) {
      try { verified = await verifyArgon2(credential.passwordHash, input.password); }
      catch { verified = false; }
    }
    if (!verified || !snapshot || !credential) {
      await this.recordPasswordReauthRejected(userId, sessionId);
      throw new ForbiddenException('Incorrect password');
    }
    const encoded = await hashArgon2(input.pin, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
    const saved = await this.database.transaction().execute(async (tx) => {
      const current = await sql<{ email_revision: string; credential_revision: string }>`
        SELECT e.email_revision::text, p.credential_revision::text
        FROM user_emails e
        JOIN password_credentials p ON p.user_id = e.user_id
        WHERE e.user_id = ${userId}::uuid AND e.normalized_email = ${snapshot.email.normalizedEmail}
        FOR UPDATE OF e, p
      `.execute(tx);
      if (current.rows[0]?.email_revision !== snapshot.email.emailRevision ||
          current.rows[0]?.credential_revision !== credential.credentialRevision) return false;
      const result = await sql`
        INSERT INTO identity_security_pins(user_id, pin_hash)
        VALUES (${userId}::uuid, ${encoded})
        ON CONFLICT (user_id) DO NOTHING RETURNING user_id
      `.execute(tx);
      return result.rows.length === 1;
    });
    if (!saved) throw new ForbiddenException('Security PIN already configured');
    return { pinConfigured: true };
  }

  private async enforceReauthLimit(userId: string, method: 'pin' | 'password') {
    if (!this.database) throw new ServiceUnavailableException('Identity database unavailable');
    const recent = await sql<{ attempts: number }>`
      SELECT count(*)::integer AS attempts FROM identity_security_events
      WHERE user_id = ${userId}::uuid AND event_code='REAUTH_REJECTED'
        AND occurred_at >= now() - interval '15 minutes'
        AND request_metadata->>'method' = ${method}
    `.execute(this.database);
    if ((recent.rows[0]?.attempts ?? 0) >= 5)
      throw new HttpException('Too many confirmations. Try again later.', HttpStatus.TOO_MANY_REQUESTS);
  }

  async completeOrganizationCreatePinReauth(
    input: { nonce: string; pin: string }, userId: string, sessionId: string,
  ): Promise<OrganizationCreateReauthProof> {
    this.requireEnabled();
    if (!userId || !sessionId || !this.database) throw new UnauthorizedException('Application session required');
    if (!/^[0-9]{6}$/.test(input.pin)) throw new ForbiddenException('Invalid security PIN');
    await this.enforceReauthLimit(userId, 'pin');
    const credential = await sql<{ pin_hash: string; revision: string }>`
      SELECT pin_hash, revision::text FROM identity_security_pins WHERE user_id=${userId}::uuid
    `.execute(this.database);
    const row = credential.rows[0];
    if (!row) throw new ForbiddenException('Security PIN not configured');
    let valid: boolean;
    try { valid = await verifyArgon2(row.pin_hash, input.pin); }
    catch { valid = false; }
    if (!valid) {
      await this.recordPasswordReauthRejected(userId, sessionId, 'pin');
      throw new ForbiddenException('Incorrect security PIN');
    }
    const now = new Date();
    const expiresAt = new Date(now.getTime() + CHALLENGE_LIFETIME_MS).toISOString();
    const proof = randomBytes(32).toString('base64url');
    const issued = await this.transactions.run(async ({ repositories }) => {
      const currentRevision = await repositories.identitySessions.lockSecurityPinRevision(userId);
      if (currentRevision !== row.revision) return false;
      const challenge = await repositories.identitySessions.consumeChallenge({
        nonceSha256: digest(input.nonce), purpose: 'REAUTH_ORGANIZATION_CREATE', now: now.toISOString(),
        userId, sessionId,
      });
      if (!challenge || challenge.userId !== userId || challenge.sessionId !== sessionId) return false;
      await repositories.identitySessions.createChallenge({
        challengeId: randomUUID(), purpose: 'REAUTH_ORGANIZATION_CREATE',
        nonceSha256: digest(proof), userId, sessionId, createdAt: now.toISOString(), expiresAt,
      });
      await repositories.identitySessions.appendSecurityEvent({
        eventId: randomUUID(), userId, sessionId, eventCode: 'REAUTH_ISSUED', outcome: 'SUCCESS',
        occurredAt: now.toISOString(), requestMetadata: { phase: 'operation_proof', operation: 'organization.create', method: 'pin' },
      });
      return true;
    });
    if (!issued) throw new ForbiddenException('Reauthentication challenge expired or invalid');
    return { proof, expiresAt };
  }

  async accountSecurityStatus(userId: string): Promise<{
    email: string | null; googleLinked: boolean; passwordConfigured: boolean;
  }> {
    this.requireEnabled();
    if (!this.database || !userId) throw new UnauthorizedException('Application session required');
    const [email, google, credential] = await Promise.all([
      this.database.selectFrom('user_emails').select('email_address')
        .where('user_id', '=', userId).executeTakeFirst(),
      this.database.selectFrom('auth_identities').select('auth_identity_id')
        .where('user_id', '=', userId).where('provider', '=', 'google').executeTakeFirst(),
      this.database.selectFrom('password_credentials').select('user_id')
        .where('user_id', '=', userId).executeTakeFirst(),
    ]);
    return { email: email?.email_address ?? null, googleLinked: !!google, passwordConfigured: !!credential };
  }

  async changeSecurityPin(
    input: { currentPin: string; newPin: string }, userId: string, sessionId: string,
  ): Promise<{ pinConfigured: boolean }> {
    this.requireEnabled();
    if (!this.database || !userId || !sessionId) throw new UnauthorizedException('Application session required');
    if (!/^[0-9]{6}$/.test(input.currentPin) || !/^[0-9]{6}$/.test(input.newPin) ||
        input.currentPin === input.newPin) throw new ForbiddenException('Invalid security PIN');
    await this.enforceReauthLimit(userId, 'pin');
    const old = await sql<{ pin_hash: string; revision: string }>`
      SELECT pin_hash, revision::text FROM identity_security_pins WHERE user_id=${userId}::uuid
    `.execute(this.database);
    let valid = false;
    if (old.rows[0]) {
      try { valid = await verifyArgon2(old.rows[0].pin_hash, input.currentPin); }
      catch { valid = false; }
    }
    if (!valid) {
      await this.recordPasswordReauthRejected(userId, sessionId, 'pin');
      throw new ForbiddenException('Incorrect security PIN');
    }
    const nextHash = await hashArgon2(input.newPin, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
    const now = new Date().toISOString();
    const changed = await this.database.transaction().execute(async (tx) => {
      const current = await sql<{ revision: string }>`
        SELECT revision::text FROM identity_security_pins
        WHERE user_id=${userId}::uuid FOR UPDATE
      `.execute(tx);
      if (current.rows[0]?.revision !== old.rows[0]?.revision) return false;
      await sql`
        UPDATE identity_security_pins SET pin_hash=${nextHash}, revision=revision+1, changed_at=${now}
        WHERE user_id=${userId}::uuid
      `.execute(tx);
      await sql`
        INSERT INTO identity_security_events(event_id, user_id, session_id, event_code, outcome, occurred_at, request_metadata)
        VALUES (${randomUUID()}::uuid, ${userId}::uuid, ${sessionId}::uuid, 'REAUTH_ISSUED',
                'SUCCESS', ${now}::timestamptz, '{"operation":"pin.change"}'::jsonb)
      `.execute(tx);
      return true;
    });
    if (!changed) throw new ForbiddenException('Security PIN has changed. Try again');
    return { pinConfigured: true };
  }

  async changeOwnPassword(
    input: { currentPassword: string; newPassword: string }, userId: string, sessionId: string,
  ): Promise<{ changed: boolean }> {
    this.requireEnabled();
    if (!this.database || !userId || !sessionId) throw new UnauthorizedException('Application session required');
    if (input.newPassword.length < 8 || input.newPassword.length > 1024 ||
        input.newPassword === input.currentPassword) throw new ForbiddenException('Invalid new password');
    await this.enforceReauthLimit(userId, 'password');
    const email = await this.database.selectFrom('user_emails').select('normalized_email')
      .where('user_id', '=', userId).executeTakeFirst();
    const snapshot = email ? await this.transactions.run(({ repositories }) =>
      repositories.identityFoundation.findPrimaryLogin(email.normalized_email)) : null;
    let valid = false;
    if (snapshot?.email.userId === userId && snapshot.credential?.passwordHash) {
      try { valid = await verifyArgon2(snapshot.credential.passwordHash, input.currentPassword); }
      catch { valid = false; }
    }
    if (!valid || !snapshot?.credential) {
      await this.recordPasswordReauthRejected(userId, sessionId);
      throw new ForbiddenException('Incorrect password');
    }
    const encoded = await hashArgon2(input.newPassword, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
    const now = new Date().toISOString();
    await this.transactions.run(async ({ repositories }) => {
      await repositories.identityFoundation.validateLoginSnapshot({
        userId, userEmailId: snapshot.email.userEmailId, normalizedEmail: snapshot.email.normalizedEmail,
        emailRevision: snapshot.email.emailRevision,
        credentialRevision: snapshot.credential!.credentialRevision,
      });
      await repositories.identityFoundation.replacePasswordCredential({
        userId, expectedRevision: snapshot.credential!.credentialRevision,
        encodedHash: encoded, kind: 'change', now,
      });
      await repositories.identitySessions.revokeOtherSessions({
        userId, exceptSessionId: sessionId, now, reason: 'PASSWORD_CHANGED',
      });
      await repositories.identitySessions.appendSecurityEvent({
        eventId: randomUUID(), userId, sessionId, occurredAt: now,
        eventCode: 'REAUTH_ISSUED', outcome: 'SUCCESS',
        requestMetadata: { operation: 'password.change' },
      });
    });
    return { changed: true };
  }

  async authenticateGoogle(input: { idToken: string; nonce: string }): Promise<IdentitySessionResponse> {
    return this.completeGoogle(input, 'LOGIN');
  }

  async registerGoogle(input: { idToken: string; nonce: string }): Promise<IdentitySessionResponse> {
    return this.completeGoogle(input, 'REGISTER');
  }

  /**
   * Password login uses only verified email + Argon2id credentials from Identity Foundation.
   * Never exchanges local_dev_accounts credentials or creates accounts implicitly.
   */
  async authenticatePassword(input: { email: string; password: string }): Promise<IdentitySessionResponse> {
    this.requireEnabled();
    let normalizedEmail: string;
    try {
      normalizedEmail = normalizeLoginEmail(input.email);
    } catch {
      await this.recordRejected('AUTHENTICATION_REJECTED', 'invalid_credentials');
      throw new UnauthorizedException('Email or password is incorrect');
    }
    const loginKey = digest('password-login:' + normalizedEmail);
    if (this.database) {
      const recent = await sql<{ attempts: number }>`
        SELECT count(*)::integer AS attempts FROM identity_security_events
        WHERE event_code = 'AUTHENTICATION_REJECTED'
          AND occurred_at >= now() - interval '15 minutes'
          AND request_metadata->>'loginKey' = ${loginKey}
      `.execute(this.database);
      if ((recent.rows[0]?.attempts ?? 0) >= 5)
        throw new HttpException('Too many sign-in attempts. Try again later.', HttpStatus.TOO_MANY_REQUESTS);
    }
    const snapshot = await this.transactions.run(({ repositories }) =>
      repositories.identityFoundation.findPrimaryLogin(normalizedEmail),
    );
    const credential = snapshot?.credential;
    let valid = false;
    if (credential?.passwordHash && input.password) {
      try {
        valid = await verifyArgon2(credential.passwordHash, input.password);
      } catch {
        valid = false;
      }
    }
    if (!snapshot || !credential || !valid) {
      await this.recordRejected('AUTHENTICATION_REJECTED', 'invalid_credentials', loginKey);
      throw new UnauthorizedException('Email or password is incorrect');
    }
    if (resetTestEmail(process.env) === normalizedEmail && this.database) {
      await sql`SELECT trooi_reset_owner_work(${snapshot.email.userId}::uuid)`.execute(this.database);
    }

    const now = new Date();
    const accessToken = randomBytes(32).toString('base64url');
    const refreshToken = randomBytes(32).toString('base64url');
    const sessionId = randomUUID();
    const createdAt = now.toISOString();
    const absoluteExpiresAt = new Date(now.getTime() + ABSOLUTE_LIFETIME_MS).toISOString();
    try {
      await this.transactions.run(async ({ repositories }) => {
        // Prevent login with a password revoked or replaced while Argon2 was running.
        await repositories.identityFoundation.validateLoginSnapshot({
          userId: snapshot.email.userId,
          userEmailId: snapshot.email.userEmailId,
          emailRevision: snapshot.email.emailRevision,
          normalizedEmail,
          credentialRevision: credential.credentialRevision,
        });
        await repositories.identitySessions.createSession({
          sessionId, familyId: sessionId, userId: snapshot.email.userId,
          accessTokenSha256: digest(accessToken),
          accessExpiresAt: new Date(now.getTime() + ACCESS_LIFETIME_MS).toISOString(),
          refreshTokenSha256: digest(refreshToken), createdAt,
          idleExpiresAt: new Date(now.getTime() + IDLE_LIFETIME_MS).toISOString(),
          absoluteExpiresAt, authenticatedAt: createdAt,
        });
        await repositories.identitySessions.appendSecurityEvent({
          eventId: randomUUID(), userId: snapshot.email.userId, sessionId,
          eventCode: 'SESSION_CREATED', outcome: 'SUCCESS',
          occurredAt: createdAt, requestMetadata: { purpose: 'PASSWORD_LOGIN' },
        });
      });
    } catch {
      await this.recordRejected('AUTHENTICATION_REJECTED', 'stale_credentials', loginKey);
      throw new UnauthorizedException('Email or password is incorrect');
    }
    return {
      userId: snapshot.email.userId, sessionId, accessToken, refreshToken,
      tokenType: 'Bearer', expiresInSeconds: 900, refreshExpiresAt: absoluteExpiresAt,
    };
  }

  /** Issue a session for an isolated local fixture; NOT a Google/KYC verification. */
  async issueLocalDemoSession(userId: string): Promise<IdentitySessionResponse> {
    this.requireEnabled();
    if (process.env.NODE_ENV === 'production' ||
        process.env.TROOI_LOCAL_DEMO_AUTH !== 'true' ||
        process.env.TROOI_DATABASE_MODE !== 'compose-postgres') {
      throw new ServiceUnavailableException('Local demo sessions are disabled');
    }
    const now = new Date();
    const accessToken = randomBytes(32).toString('base64url');
    const refreshToken = randomBytes(32).toString('base64url');
    const sessionId = randomUUID();
    const createdAt = now.toISOString();
    const absoluteExpiresAt = new Date(now.getTime() + ABSOLUTE_LIFETIME_MS).toISOString();
    await this.transactions.run(async ({ repositories }) => {
      if (!await repositories.identity.userExists(userId)) {
        throw new UnauthorizedException('Local demo user does not exist');
      }
      await repositories.identitySessions.createSession({
        sessionId, familyId: sessionId, userId,
        accessTokenSha256: digest(accessToken),
        accessExpiresAt: new Date(now.getTime() + ACCESS_LIFETIME_MS).toISOString(),
        refreshTokenSha256: digest(refreshToken), createdAt,
        idleExpiresAt: new Date(now.getTime() + IDLE_LIFETIME_MS).toISOString(),
        absoluteExpiresAt, authenticatedAt: createdAt,
      });
    });
    return { userId, sessionId, accessToken, refreshToken,
      tokenType: 'Bearer', expiresInSeconds: 900, refreshExpiresAt: absoluteExpiresAt };
  }

  async refresh(refreshToken: string): Promise<IdentitySessionResponse> {
    this.requireEnabled();
    if (!refreshToken?.trim()) throw new UnauthorizedException('Refresh credential is invalid');
    const now = new Date();
    const accessToken = randomBytes(32).toString('base64url');
    const nextRefreshToken = randomBytes(32).toString('base64url');
    const accessExpiresAt = new Date(now.getTime() + ACCESS_LIFETIME_MS).toISOString();
    const result = await this.transactions.run(({ repositories }) => repositories.identitySessions.rotateRefreshToken({
      oldRefreshTokenSha256: digest(refreshToken), newRefreshTokenSha256: digest(nextRefreshToken),
      newAccessTokenSha256: digest(accessToken), now: now.toISOString(), accessExpiresAt,
    }));
    if (result.kind !== 'rotated') throw new UnauthorizedException('Refresh credential is invalid or revoked');
    return {
      userId: result.userId, sessionId: result.sessionId, accessToken, refreshToken: nextRefreshToken,
      tokenType: 'Bearer', expiresInSeconds: 900, refreshExpiresAt: result.absoluteExpiresAt,
    };
  }

  async logout(accessToken: string): Promise<{ revoked: boolean }> {
    this.requireEnabled();
    if (!accessToken?.trim()) throw new UnauthorizedException('Bearer token is invalid');
    const now = new Date().toISOString();
    const revoked = await this.transactions.run(({ repositories }) =>
      repositories.identitySessions.revokeByAccessToken({ accessTokenSha256: digest(accessToken), now }),
    );
    return { revoked };
  }

  async revokeAll(userId: string): Promise<{ revokedSessionCount: number }> {
    this.requireEnabled();
    const revokedSessionCount = await this.transactions.run(({ repositories }) =>
      repositories.identitySessions.revokeAll({ userId, now: new Date().toISOString() }),
    );
    return { revokedSessionCount };
  }

  private async completeGoogle(
    input: { idToken: string; nonce: string },
    purpose: 'LOGIN' | 'REGISTER',
  ): Promise<IdentitySessionResponse> {
    this.requireEnabled();
    let identity: Awaited<ReturnType<typeof verifyGoogleIdToken>>;
    try {
      identity = await verifyGoogleIdToken(this.verifier, input.idToken);
    } catch {
      await this.recordRejected('AUTHENTICATION_REJECTED', purpose);
      throw new UnauthorizedException('Google authentication was rejected');
    }
    if (!this.matchesFreshNonce(input.nonce, identity.nonce) ||
        (purpose === 'REGISTER' && !this.isRecentAuth(identity.authTime))) {
      await this.recordRejected('CHALLENGE_REJECTED', purpose);
      throw new UnauthorizedException('Google authentication challenge is invalid or expired');
    }
    let normalizedEmail: string | null = null;
    if (identity.emailVerified === true && identity.email) {
      try { normalizedEmail = normalizeLoginEmail(identity.email); }
      catch {
        if (purpose === 'REGISTER') {
          await this.recordRejected('REGISTRATION_REJECTED', 'invalid_email');
          throw new UnauthorizedException('Google registration was rejected');
        }
      }
    } else if (purpose === 'REGISTER') {
      await this.recordRejected('REGISTRATION_REJECTED', 'unverified_email');
      throw new UnauthorizedException('Verified Google email is required for registration');
    }

    const nonceHash = digest(input.nonce);
    const now = new Date();
    const consumed = await this.transactions.run(async ({ repositories }) => {
      const challenge = await repositories.identitySessions.consumeChallenge({
        nonceSha256: nonceHash, purpose, now: now.toISOString(),
      });
      if (!challenge) {
        await repositories.identitySessions.appendSecurityEvent({
          eventId: randomUUID(), userId: null, sessionId: null, eventCode: 'CHALLENGE_REJECTED',
          outcome: 'REJECTED', occurredAt: now.toISOString(), requestMetadata: { purpose },
        });
      }
      return challenge;
    });
    if (!consumed) throw new UnauthorizedException('Google authentication challenge is invalid or already used');

    const accessToken = randomBytes(32).toString('base64url');
    const refreshToken = randomBytes(32).toString('base64url');
    const sessionId = randomUUID();
    const createdAt = now.toISOString();
    if (!identity.issuedAt) throw new UnauthorizedException('Verified Google token has no issuance time');
    const authenticatedAt = new Date((identity.authTime ?? identity.issuedAt) * 1000).toISOString();
    const accessExpiresAt = new Date(now.getTime() + ACCESS_LIFETIME_MS).toISOString();
    const absoluteExpiresAt = new Date(now.getTime() + ABSOLUTE_LIFETIME_MS).toISOString();
    const idleExpiresAt = new Date(now.getTime() + IDLE_LIFETIME_MS).toISOString();
    try {
      const result = await this.transactions.run(async ({ repositories }) => {
        const principal = { issuer: identity.issuer as 'accounts.google.com' | 'https://accounts.google.com', subject: identity.subject };
        const resolved = await repositories.identityFoundation.resolveGooglePrincipal(principal);
        let userId: string;
        let newUser = false;
        if (resolved.kind === 'resolved') {
          userId = resolved.userId;
        } else if (normalizedEmail) {
          const created = await repositories.identityFoundation.createGoogleUserFoundation({
            principal,
            email: { address: identity.email!, normalizedEmail, verifiedAt: createdAt, verificationSource: 'google' },
            displayName: identity.name?.trim() || null,
            now: createdAt,
          });
          userId = created.userId;
          newUser = true;
        } else {
          await repositories.identitySessions.appendSecurityEvent({
            eventId: randomUUID(), userId: null, sessionId: null, eventCode: 'AUTHENTICATION_REJECTED',
            outcome: 'REJECTED', occurredAt: createdAt, requestMetadata: { purpose, reason: 'unbound_identity' },
          });
          return null;
        }
        await repositories.identitySessions.createSession({
          sessionId, familyId: sessionId, userId, accessTokenSha256: digest(accessToken),
          accessExpiresAt, refreshTokenSha256: digest(refreshToken), createdAt,
          idleExpiresAt, absoluteExpiresAt, authenticatedAt,
        });
        if (newUser) await repositories.identitySessions.appendSecurityEvent({
          eventId: randomUUID(), userId, sessionId, eventCode: 'REGISTRATION_SUCCEEDED',
          outcome: 'SUCCESS', occurredAt: createdAt,
        });
        return { userId };
      });
      if (!result) throw new UnauthorizedException('Google account is not registered');
      return {
        userId: result.userId, sessionId, accessToken, refreshToken, tokenType: 'Bearer',
        expiresInSeconds: 900, refreshExpiresAt: absoluteExpiresAt,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      const eventCode = purpose === 'REGISTER' ? 'REGISTRATION_REJECTED' : 'IDENTITY_COLLISION';
      await this.recordRejected(eventCode, purpose);
      throw new ServiceUnavailableException(purpose === 'REGISTER'
        ? 'Google registration could not be completed'
        : 'Google identity binding is unavailable');
    }
  }

  private matchesFreshNonce(expected: string, actual?: string): boolean {
    if (!expected || !actual) return false;
    const left = Buffer.from(expected);
    const right = Buffer.from(actual);
    return left.length === right.length && timingSafeEqual(left, right);
  }

  private isRecentGoogleSetupProof(authTime?: number, issuedAt?: number): boolean {
    if (authTime !== undefined) return this.isRecentAuth(authTime);
    // Android Credential Manager may omit optional auth_time; the nonce-bound,
    // Google-signed ID token must then have a very recent issuance time.
    if (!Number.isSafeInteger(issuedAt) || !issuedAt) return false;
    const age = Date.now() - issuedAt * 1000;
    return age >= -60_000 && age <= 90_000;
  }

  private isRecentAuth(authTime?: number): boolean {
    if (!Number.isSafeInteger(authTime) || !authTime) return false;
    const age = Date.now() - authTime * 1000;
    return age >= -60_000 && age <= MAX_AUTH_AGE_MS;
  }

  private async recordRejected(eventCode: 'AUTHENTICATION_REJECTED' | 'CHALLENGE_REJECTED' | 'REGISTRATION_REJECTED' | 'IDENTITY_COLLISION', reason: string, loginKey?: string): Promise<void> {
    const now = new Date().toISOString();
    await this.transactions.run(({ repositories }) => repositories.identitySessions.appendSecurityEvent({
      eventId: randomUUID(), userId: null, sessionId: null, eventCode, outcome: 'REJECTED',
      occurredAt: now, requestMetadata: { reason: reason.slice(0, 48), ...(loginKey ? { loginKey } : {}) },
    }));
  }

  private async recordReauthRejected(userId: string, sessionId: string, reason: string): Promise<void> {
    const now = new Date().toISOString();
    await this.transactions.run(({ repositories }) => repositories.identitySessions.appendSecurityEvent({
      eventId: randomUUID(), userId, sessionId, eventCode: 'REAUTH_REJECTED', outcome: 'REJECTED',
      occurredAt: now, requestMetadata: { reason: reason.slice(0, 48) },
    }));
  }

  private async recordInitialPasswordSetupRejected(userId: string, sessionId: string, reason: string): Promise<void> {
    const now = new Date().toISOString();
    await this.transactions.run(({ repositories }) => repositories.identitySessions.appendSecurityEvent({
      eventId: randomUUID(), userId, sessionId, eventCode: 'REAUTH_REJECTED', outcome: 'REJECTED',
      occurredAt: now, requestMetadata: { method: 'google', operation: 'password.initial_setup', reason: reason.slice(0, 48) },
    }));
  }

  private requireEnabled(): void {
    if (process.env.TROOI_IDENTITY_FOUNDATION_RESOLUTION_ENABLED !== 'true') {
      throw new ServiceUnavailableException('Identity session exchange is disabled pending acceptance');
    }
  }
}

function digest(value: string): string { return createHash('sha256').update(value).digest('hex'); }
