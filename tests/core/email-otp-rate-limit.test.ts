import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { type ExecutionContext, HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Kysely, PostgresDialect } from 'kysely';
import { EmailOtpRateLimit, EmailOtpRateLimitGuard } from '../../src/modules/identity-access/guards/email-otp-rate-limit.guard';
import type { Database } from '../../src/infrastructure/database/schema.types';

function context(ip = '192.0.2.1', action: 'issue' | 'verify' = 'issue'): ExecutionContext {
  class Endpoint { @EmailOtpRateLimit(action) run() {} }
  return {
    getHandler: () => Endpoint.prototype.run,
    switchToHttp: () => ({ getRequest: () => ({ ip, headers: { 'x-forwarded-for': '198.51.100.1' } }) }),
  } as unknown as ExecutionContext;
}

function fixture(enabled = true, denyAt = 0) {
  const queries: Array<{ sql: string; parameters: readonly unknown[] }> = [];
  let inserts = 0;
  const database = new Kysely<Database>({ dialect: new PostgresDialect({ pool: {
    connect: async () => ({
      release() {},
      query: async (sql: string, parameters: unknown[] = []) => {
        queries.push({ sql, parameters });
        if (sql.includes('INSERT INTO')) {
          inserts++;
          return { rows: (denyAt === 1 || inserts === denyAt) ? [] : [{ hits: 1 }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      },
    }), end: async () => {},
  } as never }) });
  return { queries, guard: new EmailOtpRateLimitGuard(database, {
    enabled, otpHmacSecret: 'test-secret-at-least-32-characters', smtp: null,
  }, new Reflector()) };
}

test('disabled OTP performs no rate bucket database work', async () => {
  const { guard, queries } = fixture(false);
  assert.equal(await guard.canActivate(context()), true);
  assert.equal(queries.length, 0);
});

test('global denial commits the source budget before returning 429', async () => {
  const { guard, queries } = fixture(true, 2);
  await assert.rejects(guard.canActivate(context()), (error: unknown) =>
    error instanceof HttpException && error.getStatus() === 429);
  assert.equal(queries.at(-1)?.sql.toLowerCase(), 'commit');
  const inserts = queries.filter(q => q.sql.includes('INSERT INTO'));
  assert.equal(inserts.length, 2);
  assert.ok(inserts[0]!.parameters.includes(30));
  assert.ok(inserts[1]!.parameters.includes(300));
  assert.equal(JSON.stringify(queries).includes('192.0.2.1'), false);
  assert.equal(JSON.stringify(queries).includes('198.51.100.1'), false);
});

test('a forged forwarding header does not replace the Express source key', async () => {
  const first = fixture();
  const second = fixture();
  assert.equal(await first.guard.canActivate(context('192.0.2.1')), true);
  assert.equal(await second.guard.canActivate(context('192.0.2.2')), true);
  const key = (queries: typeof first.queries) => queries.filter(q => q.sql.includes('INSERT INTO'))[0]!.parameters[0];
  assert.notEqual(key(first.queries), key(second.queries));
});


test('repeated source denials never charge the shared global budget', async () => {
  const { guard, queries } = fixture(true, 1);
  await assert.rejects(guard.canActivate(context()), (error: unknown) =>
    error instanceof HttpException && error.getStatus() === 429);
  await assert.rejects(guard.canActivate(context()), (error: unknown) =>
    error instanceof HttpException && error.getStatus() === 429);
  const inserts = queries.filter(q => q.sql.includes('INSERT INTO'));
  assert.equal(inserts.length, 2);
  for (const insert of inserts) {
    assert.ok(insert.parameters.includes(30));
    assert.equal(insert.parameters.includes(300), false);
  }
  assert.equal(queries.at(-1)?.sql.toLowerCase(), 'commit');
});

test('verification uses the separate global and source attempt budgets', async () => {
  const { guard, queries } = fixture();
  assert.equal(await guard.canActivate(context('192.0.2.1', 'verify')), true);
  const inserts = queries.filter(q => q.sql.includes('INSERT INTO'));
  assert.ok(inserts[0]!.parameters.includes(120));
  assert.ok(inserts[1]!.parameters.includes(1200));
});
