import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';

/** Reach an exact named prefix; later migrations never change the tested boundary. */
export async function paymentMigrationPrefix(databaseUrl: string, target: string): Promise<void> {
  const names = readdirSync(join(process.cwd(), 'database/migrations'))
    .filter((name) => /^\d+_.+\.ts$/.test(name))
    .map((name) => name.slice(0, -3))
    .sort();
  const targetCount = names.indexOf(target) + 1;
  assert.ok(targetCount, `Unknown migration prefix ${target}`);
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  let applied: string[];
  try {
    const exists = await client.query(
      "SELECT to_regclass('public.schema_migrations') IS NOT NULL AS present",
    );
    applied = exists.rows[0].present
      ? (await client.query('SELECT name FROM schema_migrations ORDER BY id')).rows.map(
          (row) => row.name,
        )
      : [];
  } finally {
    await client.end();
  }
  assert.deepEqual(
    applied,
    names.slice(0, applied.length),
    'Migration ledger must be an ordered known prefix',
  );
  const delta = targetCount - applied.length;
  if (delta === 0) return;
  const { runner } = await import('node-pg-migrate');
  await runner({
    databaseUrl,
    direction: delta > 0 ? 'up' : 'down',
    count: Math.abs(delta),
    dir: join(process.cwd(), 'database/migrations'),
    migrationsTable: 'schema_migrations',
    checkOrder: true,
  });
}
