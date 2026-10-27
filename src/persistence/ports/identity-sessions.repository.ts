export type IdentityChallengePurpose = 'LOGIN' | 'REGISTER' | 'REAUTH_ORGANIZATION_CREATE' | 'INITIAL_PASSWORD_SETUP';
export type IdentityEventCode =
  | 'CHALLENGE_ISSUED' | 'CHALLENGE_REJECTED' | 'REGISTRATION_SUCCEEDED' | 'REGISTRATION_REJECTED'
  | 'SESSION_CREATED' | 'SESSION_REFRESHED' | 'SESSION_REFRESH_REUSE' | 'SESSION_REFRESH_REJECTED'
  | 'AUTHENTICATION_REJECTED' | 'SESSION_LOGOUT' | 'SESSION_REVOKED' | 'IDENTITY_COLLISION'
  | 'REAUTH_ISSUED' | 'REAUTH_REJECTED' | 'PASSWORD_INITIALIZED' | 'EMAIL_CHANGED' | 'EMAIL_CHANGE_NOTICE_FAILED';

export interface AuthSessionCreateInput {
  sessionId: string; familyId: string; userId: string; accessTokenSha256: string;
  accessExpiresAt: string; refreshTokenSha256: string; createdAt: string; idleExpiresAt: string;
  absoluteExpiresAt: string; authenticatedAt: string;
}

export interface IdentitySessionsRepository {
  createChallenge(input: {
    challengeId: string; purpose: IdentityChallengePurpose; nonceSha256: string;
    userId: string | null; sessionId: string | null; createdAt: string; expiresAt: string;
  }): Promise<void>;
  consumeChallenge(input: {
    nonceSha256: string; purpose: IdentityChallengePurpose; now: string;
    userId?: string; sessionId?: string;
  }): Promise<{ challengeId: string; userId: string | null; sessionId: string | null } | null>;
  createSession(input: AuthSessionCreateInput): Promise<void>;
  resolveAccessToken(input: { accessTokenSha256: string; now: string }): Promise<{
    sessionId: string; userId: string; authenticatedAt: string;
  } | null>;
  rotateRefreshToken(input: {
    oldRefreshTokenSha256: string; newRefreshTokenSha256: string; newAccessTokenSha256: string;
    now: string; accessExpiresAt: string;
  }): Promise<{ kind: 'rotated'; sessionId: string; userId: string; authenticatedAt: string; absoluteExpiresAt: string } | { kind: 'rejected' | 'reused' }>;
  revokeByAccessToken(input: { accessTokenSha256: string; now: string }): Promise<boolean>;
  revokeAll(input: { userId: string; now: string }): Promise<number>;
  revokeOtherSessions(input: { userId: string; exceptSessionId: string; now: string }): Promise<number>;
  appendSecurityEvent(input: {
    eventId: string; userId: string | null; sessionId: string | null; eventCode: IdentityEventCode;
    outcome: 'SUCCESS' | 'REJECTED'; occurredAt: string; requestMetadata?: Record<string, string | number | boolean | null>;
  }): Promise<void>;
}
