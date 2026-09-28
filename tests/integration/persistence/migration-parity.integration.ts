import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { Client } from 'pg';

import { runMigrations } from '../../../scripts/database/migrate';
import {
  queryCatalog,
  resetPublicSchema,
} from './support/postgres-test-harness';

test('initial migration matches the frozen physical catalog', async () => {
  const databaseUrl = process.env.TEST_DATABASE_URL;
  assert.ok(databaseUrl, 'TEST_DATABASE_URL is required for migration parity');

  await resetPublicSchema(databaseUrl);
  await runMigrations('up', databaseUrl);

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const extension = await client.query<{ installed: boolean }>(
      "SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') AS installed",
    );
    assert.equal(extension.rows[0]?.installed, true);
  } finally {
    await client.end();
  }

  const catalog = await queryCatalog(databaseUrl);
  assert.equal(catalog.tables.length, 29);

  const directory = mkdtempSync(join(tmpdir(), 'trooi-catalog-'));
  const catalogPath = join(directory, 'catalog.json');
  try {
    writeFileSync(catalogPath, JSON.stringify(catalog), 'utf8');
    const verification = spawnSync(
      process.env.PYTHON ?? 'python',
      [
        'scripts/database/physical_contract_verify_catalog.py',
        'docs/database/erd/trooi-erd-lv3-physical.json',
        catalogPath,
      ],
      { cwd: process.cwd(), encoding: 'utf8' },
    );
    assert.equal(
      verification.status,
      0,
      `${verification.stdout}${verification.stderr}`,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
