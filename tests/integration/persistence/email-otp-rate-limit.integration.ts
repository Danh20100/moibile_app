import 'reflect-metadata';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import test from 'node:test';
import { HttpException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Kysely, PostgresDialect, sql } from 'kysely';
import { Pool } from 'pg';
import type { Database } from '../../../src/infrastructure/database/schema.types';
import { EmailOtpRateLimit, EmailOtpRateLimitGuard } from '../../../src/modules/identity-access/guards/email-otp-rate-limit.guard';

test('PostgreSQL OTP budgets reject concurrent excess guesses without exhausting the global budget', {
  skip: !process.env.TEST_DATABASE_URL && 'isolated TEST_DATABASE_URL required',
}, async () => {
  const schema = 'otp_rate_' + randomUUID().replaceAll('-', '');
  const admin = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
  await admin.query(`CREATE SCHEMA ${schema}`);
  const db = new Kysely<Database>({ dialect: new PostgresDialect({ pool: new Pool({
    connectionString: process.env.TEST_DATABASE_URL, max: 12, options: `-c search_path=${schema}`,
  }) }) });
  try {
    await sql.raw(readFileSync(join(__dirname, '../../../database/migrations/sql/000025_otp_rate_buckets.up.sql'), 'utf8')).execute(db);
    const guard = new EmailOtpRateLimitGuard(db, {
      enabled: true, otpHmacSecret: 'isolated-test-secret-at-least-32chars', smtp: null,
    }, new Reflector());
    class Endpoint { @EmailOtpRateLimit('issue') run() {} }
    const context = {
      getHandler: () => Endpoint.prototype.run,
      switchToHttp: () => ({ getRequest: () => ({ ip: '192.0.2.1' }) }),
    } as unknown as ExecutionContext;
    const outcomes = await Promise.allSettled(Array.from({ length: 40 }, () => guard.canActivate(context)));
    assert.equal(outcomes.filter(r => r.status === 'fulfilled').length, 30);
    const rejected = outcomes.filter(r => r.status === 'rejected');
    assert.equal(rejected.length, 10);
    for (const outcome of rejected) {
      assert.ok(outcome.reason instanceof HttpException);
      assert.equal(outcome.reason.getStatus(), 429);
    }
    const counts = await sql<{ seconds: number; hits: number }>`
      SELECT extract(epoch FROM expires_at - window_start)::integer AS seconds, sum(hits)::integer AS hits
      FROM identity_otp_rate_buckets GROUP BY expires_at - window_start ORDER BY seconds
    `.execute(db);
    assert.deepEqual(counts.rows, [{ seconds: 60, hits: 30 }, { seconds: 900, hits: 30 }]);
  } finally {
    await db.destroy();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  }
});
