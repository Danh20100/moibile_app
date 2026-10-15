import assert from 'node:assert/strict';
import test from 'node:test';
import { sql } from 'kysely';

import { runMigrations } from '../../../scripts/database/migrate';
import {
  createDatabaseClient,
  type DateString,
  type DecimalString,
  type TimestampString,
} from '../../../src/infrastructure/database';
import { resetPublicSchema } from './support/postgres-test-harness';

test('database client preserves exact scalar values at the persistence boundary', async () => {
  const databaseUrl = process.env.TEST_DATABASE_URL;
  assert.ok(databaseUrl, 'TEST_DATABASE_URL is required for database client integration');
  await resetPublicSchema(databaseUrl);
  await runMigrations('up', databaseUrl);

  const database = createDatabaseClient({
    url: databaseUrl,
    maxPoolSize: 2,
    connectionTimeoutMs: 5000,
  });
  try {
    await sql`CREATE TEMP TABLE scalar_round_trip (
      amount numeric(18,2) NOT NULL,
      calendar_date date NOT NULL,
      occurred_at timestamptz NOT NULL
    )`.execute(database);
    await sql`INSERT INTO scalar_round_trip (amount, calendar_date, occurred_at)
      VALUES (
        ${'9999999999999999.99'}::numeric,
        ${'2026-09-28'}::date,
        ${'2026-09-28T14:15:16+07:00'}::timestamptz
      )`.execute(database);

    const result = await sql<{
      amount: DecimalString;
      calendar_date: DateString;
      occurred_at: TimestampString;
    }>`SELECT amount, calendar_date, occurred_at FROM scalar_round_trip`.execute(
      database,
    );
    assert.deepEqual(result.rows, [
      {
        amount: '9999999999999999.99',
        calendar_date: '2026-09-28',
        occurred_at: '2026-09-28T07:15:16.000Z',
      },
    ]);
  } finally {
    await database.destroy();
  }
});
