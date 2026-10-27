import { randomUUID } from 'node:crypto';
import { sql, type Transaction } from 'kysely';

import type {
  AuthSessionCreateInput,
  IdentityChallengePurpose,
  IdentityEventCode,
  IdentitySessionsRepository,
} from '../../../persistence/ports/identity-sessions.repository';
import type { Database } from '../schema.types';

const IDLE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export class PostgresIdentitySessionsRepository implements IdentitySessionsRepository {
  constructor(private readonly tx: Transaction<Database>) {
    if (!tx.isTransaction) throw new Error('Identity Sessions requires a caller-owned transaction');
  }

  async createChallenge(input: {
    challengeId: string; purpose: IdentityChallengePurpose; nonceSha256: string;
    userId: string | null; sessionId: string | null; createdAt: string; expiresAt: string;
  }): Promise<void> {
    await this.tx.insertInto('identity_auth_challenges').values({
      challenge_id: input.challengeId, purpose: input.purpose, nonce_sha256: input.nonceSha256,
      user_id: input.userId, session_id: input.sessionId, created_at: input.createdAt,
      expires_at: input.expiresAt, consumed_at: null,
    }).execute();
  }

  async consumeChallenge(input: {
    nonceSha256: string; purpose: IdentityChallengePurpose; now: string;
    userId?: string; sessionId?: string;
  }) {
    const row = await this.tx.updateTable('identity_auth_challenges')
      .set({ consumed_at: input.now })
      .where('nonce_sha256', '=', input.nonceSha256)
      .where('purpose', '=', input.purpose)
      .where(sql<boolean>`(${input.userId ?? null}::uuid IS NULL OR user_id = ${input.userId ?? null}::uuid)`)
      .where(sql<boolean>`(${input.sessionId ?? null}::uuid IS NULL OR session_id = ${input.sessionId ?? null}::uuid)`)
      .where('expires_at', '>', input.now)
      .where('consumed_at', 'is', null)
      .returning(['challenge_id', 'user_id', 'session_id'])
      .executeTakeFirst();
    return row ? { challengeId: row.challenge_id, userId: row.user_id, sessionId: row.session_id } : null;
  }

  async lockSecurityPinRevision(userId: string): Promise<string | null> {
    const result = await sql<{ revision: string }>`
      SELECT revision::text FROM identity_security_pins WHERE user_id=${userId}::uuid FOR UPDATE
    `.execute(this.tx);
    return result.rows[0]?.revision ?? null;
  }

  async createSession(input: AuthSessionCreateInput): Promise<void> {
    await this.tx.insertInto('auth_sessions').values({
      session_id: input.sessionId, family_id: input.familyId, user_id: input.userId,
      access_token_sha256: input.accessTokenSha256, access_expires_at: input.accessExpiresAt,
      refresh_token_sha256: input.refreshTokenSha256, created_at: input.createdAt,
      last_seen_at: input.createdAt, idle_expires_at: input.idleExpiresAt,
      absolute_expires_at: input.absoluteExpiresAt, authenticated_at: input.authenticatedAt,
      revoked_at: null, revoke_reason: null,
    }).execute();
    await this.event({ eventId: randomUUID(), userId: input.userId, sessionId: input.sessionId,
      eventCode: 'SESSION_CREATED', outcome: 'SUCCESS', occurredAt: input.createdAt });
  }

  async resolveAccessToken(input: { accessTokenSha256: string; now: string }) {
    const row = await this.tx.selectFrom('auth_sessions')
      .select(['session_id', 'user_id', 'authenticated_at'])
      .where('access_token_sha256', '=', input.accessTokenSha256)
      .where('access_expires_at', '>', input.now)
      .where('idle_expires_at', '>', input.now)
      .where('absolute_expires_at', '>', input.now)
      .where('revoked_at', 'is', null)
      .executeTakeFirst();
    return row ? { sessionId: row.session_id, userId: row.user_id, authenticatedAt: row.authenticated_at } : null;
  }

  async rotateRefreshToken(input: {
    oldRefreshTokenSha256: string; newRefreshTokenSha256: string; newAccessTokenSha256: string;
    now: string; accessExpiresAt: string;
  }) {
    const current = await this.tx.selectFrom('auth_sessions').selectAll()
      .where('refresh_token_sha256', '=', input.oldRefreshTokenSha256)
      .forUpdate().executeTakeFirst();
    if (!current) {
      const used = await this.tx.selectFrom('auth_session_refresh_history')
        .innerJoin('auth_sessions', 'auth_sessions.session_id', 'auth_session_refresh_history.session_id')
        .select(['auth_sessions.session_id', 'auth_sessions.family_id', 'auth_sessions.user_id'])
        .where('auth_session_refresh_history.refresh_token_sha256', '=', input.oldRefreshTokenSha256)
        .forUpdate('auth_sessions').executeTakeFirst();
      if (!used) {
        await this.event({ eventId: randomUUID(), userId: null, sessionId: null,
          eventCode: 'SESSION_REFRESH_REJECTED', outcome: 'REJECTED', occurredAt: input.now });
        return { kind: 'rejected' as const };
      }
      await this.tx.updateTable('auth_sessions').set({ revoked_at: input.now, revoke_reason: 'REFRESH_REUSE' })
        .where('family_id', '=', used.family_id).where('revoked_at', 'is', null).execute();
      await this.event({ eventId: randomUUID(), userId: used.user_id, sessionId: used.session_id,
        eventCode: 'SESSION_REFRESH_REUSE', outcome: 'REJECTED', occurredAt: input.now });
      return { kind: 'reused' as const };
    }

    if (current.revoked_at !== null || Date.parse(current.idle_expires_at) <= Date.parse(input.now) ||
        Date.parse(current.absolute_expires_at) <= Date.parse(input.now)) {
      if (current.revoked_at === null) {
        await this.tx.updateTable('auth_sessions').set({ revoked_at: input.now, revoke_reason: 'EXPIRED' })
          .where('session_id', '=', current.session_id).execute();
        await this.event({ eventId: randomUUID(), userId: current.user_id, sessionId: current.session_id,
          eventCode: 'SESSION_REVOKED', outcome: 'REJECTED', occurredAt: input.now,
          requestMetadata: { reason: 'EXPIRED' } });
      }
      return { kind: 'rejected' as const };
    }

    await this.tx.insertInto('auth_session_refresh_history').values({
      refresh_token_sha256: input.oldRefreshTokenSha256, session_id: current.session_id, rotated_at: input.now,
    }).execute();
    const absoluteExpiry = Date.parse(current.absolute_expires_at);
    const nextIdleExpiry = new Date(Math.min(Date.parse(input.now) + IDLE_WINDOW_MS, absoluteExpiry)).toISOString();
    await this.tx.updateTable('auth_sessions').set({
      refresh_token_sha256: input.newRefreshTokenSha256,
      access_token_sha256: input.newAccessTokenSha256,
      access_expires_at: input.accessExpiresAt,
      last_seen_at: input.now,
      idle_expires_at: nextIdleExpiry,
    }).where('session_id', '=', current.session_id).execute();
    await this.event({ eventId: randomUUID(), userId: current.user_id, sessionId: current.session_id,
      eventCode: 'SESSION_REFRESHED', outcome: 'SUCCESS', occurredAt: input.now });
    return { kind: 'rotated' as const, sessionId: current.session_id, userId: current.user_id,
      authenticatedAt: current.authenticated_at, absoluteExpiresAt: current.absolute_expires_at };
  }

  async revokeByAccessToken(input: { accessTokenSha256: string; now: string }): Promise<boolean> {
    const row = await this.tx.updateTable('auth_sessions').set({ revoked_at: input.now, revoke_reason: 'LOGOUT' })
      .where('access_token_sha256', '=', input.accessTokenSha256).where('revoked_at', 'is', null)
      .returning(['session_id', 'user_id']).executeTakeFirst();
    if (!row) return false;
    await this.event({ eventId: randomUUID(), userId: row.user_id, sessionId: row.session_id,
      eventCode: 'SESSION_LOGOUT', outcome: 'SUCCESS', occurredAt: input.now });
    return true;
  }

  async revokeAll(input: { userId: string; now: string }): Promise<number> {
    const sessions = await this.tx.updateTable('auth_sessions')
      .set({ revoked_at: input.now, revoke_reason: 'USER_REVOKE_ALL' })
      .where('user_id', '=', input.userId).where('revoked_at', 'is', null)
      .returning('session_id').execute();
    for (const session of sessions) await this.event({ eventId: randomUUID(), userId: input.userId,
      sessionId: session.session_id, eventCode: 'SESSION_REVOKED', outcome: 'SUCCESS', occurredAt: input.now,
      requestMetadata: { reason: 'USER_REVOKE_ALL' } });
    return sessions.length;
  }

  async revokeOtherSessions(input: {
    userId: string; exceptSessionId: string; now: string; reason?: 'EMAIL_CHANGED' | 'PASSWORD_CHANGED';
  }): Promise<number> {
    const reason = input.reason ?? 'EMAIL_CHANGED';
    const sessions = await this.tx.updateTable('auth_sessions')
      .set({ revoked_at: input.now, revoke_reason: reason })
      .where('user_id', '=', input.userId)
      .where('session_id', '!=', input.exceptSessionId)
      .where('revoked_at', 'is', null)
      .returning('session_id')
      .execute();
    for (const session of sessions) await this.event({
      eventId: randomUUID(), userId: input.userId, sessionId: session.session_id,
      eventCode: 'SESSION_REVOKED', outcome: 'SUCCESS', occurredAt: input.now,
      requestMetadata: { reason },
    });
    return sessions.length;
  }

  async appendSecurityEvent(input: {
    eventId: string; userId: string | null; sessionId: string | null; eventCode: IdentityEventCode;
    outcome: 'SUCCESS' | 'REJECTED'; occurredAt: string;
    requestMetadata?: Record<string, string | number | boolean | null>;
  }): Promise<void> { await this.event(input); }

  private async event(input: {
    eventId: string; userId: string | null; sessionId: string | null; eventCode: IdentityEventCode;
    outcome: 'SUCCESS' | 'REJECTED'; occurredAt: string;
    requestMetadata?: Record<string, string | number | boolean | null>;
  }): Promise<void> {
    await this.tx.insertInto('identity_security_events').values({
      event_id: input.eventId, user_id: input.userId, session_id: input.sessionId,
      event_code: input.eventCode, outcome: input.outcome, occurred_at: input.occurredAt,
      request_metadata: input.requestMetadata ?? {},
    }).execute();
  }
}
