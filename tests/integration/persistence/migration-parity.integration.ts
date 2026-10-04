import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { Client } from 'pg';

import { runMigrations } from '../../../scripts/database/migrate';
import { gatewayFixture } from './gateway-test-support';
import {
  queryCatalog,
  resetPublicSchema,
} from './support/postgres-test-harness';

test('disposable reset rejects other database names before connecting', async () => {
  for (const name of ['trooi_dev', 'postgres', 'trooi_test_extra', '']) {
    await assert.rejects(
      resetPublicSchema(`postgresql://localhost:1/${name}`),
      /Only trooi_test may be reset/,
    );
  }
});

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
    await client.query('CREATE TABLE gateway.reset_residue (id integer);');
    await resetPublicSchema(databaseUrl);
    await runMigrations('up', databaseUrl);
    const residue = await client.query<{ absent: boolean }>(
      "SELECT to_regclass('gateway.reset_residue') IS NULL AS absent",
    );
    assert.equal(residue.rows[0]?.absent, true);
    const foreignKeys = await client.query<{ count: number }>(
      "SELECT count(*)::integer AS count FROM pg_constraint WHERE conrelid = 'gateway.gateway_checkouts'::regclass AND contype = 'f' AND confrelid IN ('public.tenancies'::regclass, 'public.payments'::regclass)",
    );
    assert.equal(foreignKeys.rows[0]?.count, 2);
  } finally {
    await client.end();
  }

  const catalog = await queryCatalog(databaseUrl);
  assert.equal(catalog.tables.length, 29);

  const directory = mkdtempSync(join(tmpdir(), 'trooi-catalog-'));
  const catalogPath = join(directory, 'catalog.json');
  const pythonCmd =
    process.env.PYTHON ??
    (process.platform === 'win32'
      ? (existsSync(join(process.env.LOCALAPPDATA ?? '', 'Programs', 'Python', 'Python310', 'python.exe'))
          ? join(process.env.LOCALAPPDATA ?? '', 'Programs', 'Python', 'Python310', 'python.exe')
          : 'py')
      : 'python');
  try {
    writeFileSync(catalogPath, JSON.stringify(catalog), 'utf8');
    const verification = spawnSync(
      pythonCmd,
      [
        'scripts/database/physical_contract_verify_catalog.py',
        'docs/database/v1/erd/physical.json',
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

test('gateway fixture supplies an active tenancy, authorized creator and recipient', async () => {
  const databaseUrl = process.env.TEST_DATABASE_URL;
  assert.ok(databaseUrl, 'TEST_DATABASE_URL is required for gateway fixture');
  const f = await gatewayFixture(databaseUrl);
  try {
    assert.equal((await f.tenancies.findTenancy(f.ids.tenancy))?.status, 'ACTIVE');
    assert.equal((await f.tenancies.findActivePrimary(f.ids.tenancy))?.userId, f.ids.recipient);
    assert.equal(await f.identity.userExists(f.ids.creator), true);
    await f.manager.run(async ({ repositories }) => {
      assert.equal((await repositories.organization?.findOrganization(f.ids.org))?.primaryOwnerUserId, f.ids.creator);
      assert.equal((await repositories.finance.findCharge(f.ids.charge))?.amount, '1000.00');
      assert.equal((await repositories.finance.findPaymentsForTenancy(f.ids.tenancy)).length, 0);
    });
    assert.deepEqual(await f.notifications.findNotificationsByRecipient(f.ids.recipient), []);
  } finally {
    await f.db.destroy();
  }
});
