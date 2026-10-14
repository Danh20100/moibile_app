import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable, Optional, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';

import { normalizeLoginEmail } from '../../../common/identity/normalize-login-email';
import { verifyGoogleIdToken } from '../../../integrations/google-identity/verify-token';
import { GOOGLE_ID_TOKEN_VERIFIER, type GoogleIdTokenVerifier } from '../../../integrations/google-identity';
import { TRANSACTION_MANAGER, type TransactionManager } from '../../../persistence/ports/transaction-manager';

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

@Injectable()
export class IdentitySessionService {
  constructor(
    @Inject(TRANSACTION_MANAGER) private readonly transactions: TransactionManager,
    @Optional() @Inject(GOOGLE_ID_TOKEN_VERIFIER) private readonly verifier?: GoogleIdTokenVerifier,
  ) {}

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

  async authenticateGoogle(input: { idToken: string; nonce: string }): Promise<IdentitySessionResponse> {
    return this.completeGoogle(input, 'LOGIN');
  }

  async registerGoogle(input: { idToken: string; nonce: string }): Promise<IdentitySessionResponse> {
    return this.completeGoogle(input, 'REGISTER');
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
    if (purpose === 'REGISTER') {
      if (identity.emailVerified !== true || !identity.email) {
        await this.recordRejected('REGISTRATION_REJECTED', 'unverified_email');
        throw new UnauthorizedException('Verified Google email is required for registration');
      }
      try { normalizedEmail = normalizeLoginEmail(identity.email); }
      catch {
        await this.recordRejected('REGISTRATION_REJECTED', 'invalid_email');
        throw new UnauthorizedException('Google registration was rejected');
      }
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
        } else if (purpose === 'REGISTER' && normalizedEmail) {
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

  private isRecentAuth(authTime?: number): boolean {
    if (!Number.isSafeInteger(authTime) || !authTime) return false;
    const age = Date.now() - authTime * 1000;
    return age >= -60_000 && age <= MAX_AUTH_AGE_MS;
  }

  private async recordRejected(eventCode: 'AUTHENTICATION_REJECTED' | 'CHALLENGE_REJECTED' | 'REGISTRATION_REJECTED' | 'IDENTITY_COLLISION', reason: string): Promise<void> {
    const now = new Date().toISOString();
    await this.transactions.run(({ repositories }) => repositories.identitySessions.appendSecurityEvent({
      eventId: randomUUID(), userId: null, sessionId: null, eventCode, outcome: 'REJECTED',
      occurredAt: now, requestMetadata: { reason: reason.slice(0, 48) },
    }));
  }

  private requireEnabled(): void {
    if (process.env.TROOI_IDENTITY_FOUNDATION_RESOLUTION_ENABLED !== 'true') {
      throw new ServiceUnavailableException('Identity session exchange is disabled pending acceptance');
    }
  }
}

function digest(value: string): string { return createHash('sha256').update(value).digest('hex'); }
