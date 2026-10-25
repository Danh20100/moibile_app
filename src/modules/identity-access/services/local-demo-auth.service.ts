import { BadRequestException, Inject, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { scrypt as callbackScrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { sql, type Kysely } from 'kysely';
import { DATABASE_CLIENT } from '../../../infrastructure/database/database.tokens';
import type { Database } from '../../../infrastructure/database/schema.types';
import { IdentitySessionService, type IdentitySessionResponse } from './identity-session.service';

const scrypt = promisify(callbackScrypt);
const attempts = new Map<string, { count: number; until: number }>();
const WINDOW = 15 * 60_000;
const MAX_FAILURES = 5;

/**
 * Strictly local developer access. The email string in this isolated table is
 * NOT a Google identity or email-verification proof. This module is disabled
 * unless an operator explicitly opts in on a loopback-bound Compose instance.
 */
@Injectable()
export class LocalDemoAuthService {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly database: Kysely<Database>,
    private readonly sessions: IdentitySessionService,
  ) {}

  private requireLocal(): void {
    if (process.env.TROOI_LOCAL_DEMO_AUTH !== 'true' ||
        process.env.TROOI_DATABASE_MODE !== 'compose-postgres') {
      throw new ServiceUnavailableException('Local demo login is disabled');
    }
  }

  async login(identifier: string, password: string): Promise<IdentitySessionResponse> {
    this.requireLocal();
    if (typeof identifier !== 'string' || typeof password !== 'string' ||
        identifier.length > 254 || password.length < 8 || password.length > 128) {
      throw new BadRequestException('Invalid local demo login input');
    }
    const email = identifier.trim().toLowerCase();
    const gate = attempts.get(email);
    if (gate && gate.until > Date.now() && gate.count >= MAX_FAILURES) {
      throw new UnauthorizedException('Local demo login temporarily locked');
    }

    // Dev-only table is not part of the production identity authority.
    const rows = await sql<{ user_id: string; password_salt: string; password_hash: string }>`
      SELECT user_id, password_salt, password_hash
      FROM local_dev_accounts WHERE email_label = ${email}
      AND mode = 'LOCAL_DEMO_ONLY' LIMIT 1
    `.execute(this.database);
    const account = rows.rows[0];
    const salt = account?.password_salt ?? '6a4d9fc29a8aeef96263e6b720dc77a7';
    const expected = Buffer.from(account?.password_hash ?? '00'.repeat(32), 'hex');
    const actual = await scrypt(password, Buffer.from(salt, 'hex'), 32) as Buffer;
    const matched = expected.length === actual.length && timingSafeEqual(expected, actual);
    if (!account || !matched) {
      const record = gate && gate.until > Date.now() ? gate : { count: 0, until: Date.now() + WINDOW };
      record.count += 1;
      attempts.set(email, record);
      throw new UnauthorizedException('Local demo credentials invalid');
    }
    attempts.delete(email);
    return this.sessions.issueLocalDemoSession(account.user_id);
  }
}
