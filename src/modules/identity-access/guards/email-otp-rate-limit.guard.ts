import { createHmac } from 'node:crypto';
import { applyDecorators, CanActivate, ExecutionContext, HttpException, HttpStatus, Inject, Injectable, SetMetadata, UseGuards } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { sql, type Kysely } from 'kysely';
import { DATABASE_CLIENT } from '../../../infrastructure/database/database.tokens';
import type { Database } from '../../../infrastructure/database/schema.types';
import { EMAIL_AUTH_CONFIG, type EmailAuthConfig } from '../email-auth.config';

type OtpAction = 'issue' | 'verify';
const ACTION = 'email-otp-rate-action';

export function EmailOtpRateLimit(action: OtpAction) {
  return applyDecorators(SetMetadata(ACTION, action), UseGuards(EmailOtpRateLimitGuard));
}

@Injectable()
export class EmailOtpRateLimitGuard implements CanActivate {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly database: Kysely<Database>,
    @Inject(EMAIL_AUTH_CONFIG) private readonly config: EmailAuthConfig,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.config.enabled) return true;
    const action = this.reflector.get<OtpAction>(ACTION, context.getHandler());
    if (!action) return true;
    const request = context.switchToHttp().getRequest<{
      ip?: string; socket?: { remoteAddress?: string };
    }>();
    // Express derives ip using its configured trust-proxy policy. Never read X-Forwarded-For directly.
    const source = request.ip || request.socket?.remoteAddress || 'unknown';
    const budgets = [
      { scope: 'source', source, seconds: 900, limit: action === 'issue' ? 30 : 120 },
      { scope: 'global', source: 'all', seconds: 60, limit: action === 'issue' ? 300 : 1200 },
    ];
    const denied = await this.database.transaction().execute(async (tx) => {
      await sql`DELETE FROM identity_otp_rate_buckets WHERE ctid IN (
        SELECT ctid FROM identity_otp_rate_buckets WHERE expires_at <= now()
        ORDER BY expires_at LIMIT 100 FOR UPDATE SKIP LOCKED
      )`.execute(tx);
      // Reject exhausted sources before charging the shared budget. All requests
      // obtain source then global locks; no request takes these in reverse order.
      for (const budget of budgets) {
        const key = createHmac('sha256', this.config.otpHmacSecret)
          .update(JSON.stringify([action, budget.scope, budget.source])).digest('hex');
        const result = await sql<{ hits: number }>`
          INSERT INTO identity_otp_rate_buckets(bucket_key, window_start, hits, expires_at)
          VALUES (${key}, to_timestamp(floor(extract(epoch FROM now()) / ${budget.seconds}) * ${budget.seconds}), 1,
            to_timestamp((floor(extract(epoch FROM now()) / ${budget.seconds}) + 1) * ${budget.seconds}))
          ON CONFLICT (bucket_key, window_start) DO UPDATE
          SET hits = identity_otp_rate_buckets.hits + 1
          WHERE identity_otp_rate_buckets.hits < ${budget.limit}
          RETURNING hits
        `.execute(tx);
        if (!result.rows.length) return budget.seconds;
      }
      return 0;
    });
    // Throw only after commit, so accepted budgets survive a later denial.
    if (denied) throw new HttpException({
      message: 'Too many verification requests. Try again later.', code: 'OTP_RATE_LIMITED',
      errors: { retryAfterSeconds: denied },
    }, HttpStatus.TOO_MANY_REQUESTS);
    return true;
  }
}
