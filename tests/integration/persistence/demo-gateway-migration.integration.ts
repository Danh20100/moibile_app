import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Client } from 'pg';

import { runMigrations } from '../../../scripts/database/migrate';
import { HttpMomoPaymentClient } from '../../../src/modules/payment-gateway/momo/momo-client';
import { gatewayFixture, TEST_MOMO } from './gateway-test-support';
import { queryCatalog } from './support/postgres-test-harness';

const sepaySnapshot = {
  environment: 'sandbox', merchantId: 'TEST', endpoint: 'https://pay-sandbox.sepay.vn/v1/checkout/init',
  apiOrigin: 'https://pgapi-sandbox.sepay.vn', operation: 'PURCHASE', paymentMethod: 'BANK_TRANSFER', currency: 'VND',
  successUrl: 'https://merchant.example/success', errorUrl: 'https://merchant.example/error', cancelUrl: 'https://merchant.example/cancel',
};

async function fixture() {
  const url = process.env.TEST_DATABASE_URL;
  assert.ok(url, 'TEST_DATABASE_URL required');
  const parsed = new URL(url);
  assert.equal(decodeURIComponent(parsed.pathname.slice(1)), 'trooi_test');
  assert.ok(['localhost', '127.0.0.1'].includes(parsed.hostname));
  assert.equal(parsed.port, '55433');
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    assert.equal((await client.query('SELECT current_database() AS name')).rows[0].name, 'trooi_test');
    const f = await gatewayFixture(url);
    return { ...f, client, url };
  } catch (error) {
    await client.end();
    throw error;
  }
}

type Fixture = Awaited<ReturnType<typeof fixture>>;
async function insert(f: Fixture, input: {
  id?: string; provider?: string; snapshot?: object | null; stage?: string | null;
  trans?: string | null; blocker?: string | null; scope?: string | null;
  status?: string; payment?: string | null; remote?: string | null;
} = {}) {
  const id = input.id ?? randomUUID();
  const provider = input.provider ?? 'DEMO';
  await f.client.query(`INSERT INTO gateway.gateway_checkouts
    (checkout_id,tenancy_id,created_by_user_id,amount,reference_code,provider,provider_order_id,provider_request_id,
     status,created_at,updated_at,idempotency_key,fingerprint,request_snapshot,provider_partner_code,
     provider_outcome_stage,provider_trans_id,replay_blocker,resulting_payment_id,provider_remote_order_id)
    VALUES ($1,$2,$3,1000,'storage fixture',$4,$5,$6,$7,now(),now(),$8,'storage-fingerprint',$9::jsonb,$10,$11,$12,$13,$14,$15)`,
  [id, f.ids.tenancy, f.ids.creator, provider, `invoice-${id}`, `request-${id}`, input.status ?? 'CREATED', randomUUID(),
    input.snapshot == null ? null : JSON.stringify(input.snapshot), input.scope === undefined ? (provider === 'DEMO' ? 'demo:local' : provider === 'MOMO' ? 'TEST' : 'sandbox:TEST') : input.scope,
    input.stage ?? null, input.trans ?? null, input.blocker ?? null, input.payment ?? null, input.remote ?? null]);
  return id;
}

async function constraints(client: Client) {
  return (await client.query(`SELECT conname,pg_get_constraintdef(oid) AS definition FROM pg_constraint
    WHERE conrelid='gateway.gateway_checkouts'::regclass ORDER BY conname`)).rows;
}

test('DEMO null snapshot without legacy blocker, exact transaction identity and provider stages are enforced; down refuses history before DDL', async () => {
  const f = await fixture();
  try {
    const id = 'd0000000-0000-4000-8000-000000000001';
    await insert(f, { id, stage: 'DEMO_CONFIRMATION', trans: 'DEMO-d0000000000040008000000000000001' });
    const demo = await f.finance.findGatewayCheckout(id);
    assert.equal(demo?.requestSnapshot, null);
    assert.equal(demo?.replayBlocker, null);
    await insert(f, { stage: 'CREATE' });
    await insert(f);
    for (const snapshot of [{}, sepaySnapshot, new HttpMomoPaymentClient(TEST_MOMO).snapshot('demo')]) {
      await assert.rejects(insert(f, { snapshot }), /ck_gateway_checkout_(snapshot|legacy)/);
    }
    for (const stage of ['PAYMENT_IPN', 'RECONCILIATION', 'OTHER']) {
      await assert.rejects(insert(f, { stage }), /ck_gateway_checkout_stage/);
    }
    for (const trans of ['DEMO-arbitrary', '123', 'DEMO-d0000000000040008000000000000001', '', ' ']) {
      await assert.rejects(insert(f, { trans }), /ck_gateway_checkout_trans/);
    }
    await assert.rejects(insert(f, { remote: 'opaque' }), /ck_gateway_checkout_remote/);
    for (const provider of ['MOMO', 'SEPAY']) {
      await assert.rejects(insert(f, { provider }), /ck_gateway_checkout_legacy/);
      const legacyId = await insert(f, { provider, blocker: 'LEGACY_RECONCILIATION_REQUIRED' });
      assert.equal((await f.finance.findGatewayCheckout(legacyId))?.requestSnapshot, null);
      await assert.rejects(insert(f, { provider, blocker: 'LEGACY_RECONCILIATION_REQUIRED', stage: 'DEMO_CONFIRMATION' }), /ck_gateway_checkout_stage/);
    }
    const momo = new HttpMomoPaymentClient(TEST_MOMO).snapshot('momo');
    await insert(f, { provider: 'MOMO', snapshot: momo, trans: '123' });
    await assert.rejects(insert(f, { provider: 'MOMO', snapshot: momo, trans: 'opaque' }), /ck_gateway_checkout_trans/);
    await assert.rejects(insert(f, { provider: 'MOMO', snapshot: momo, trans: '123' }), /uq_gateway_checkout_provider_trans/);
    await insert(f, { provider: 'SEPAY', snapshot: sepaySnapshot, trans: 'opaque' });
    await assert.rejects(insert(f, { provider: 'SEPAY', snapshot: sepaySnapshot, trans: 'opaque' }), /uq_gateway_checkout_provider_trans/);
    await insert(f, { provider: 'SEPAY', snapshot: { ...sepaySnapshot, merchantId: 'OTHER' }, scope: 'sandbox:OTHER', trans: 'opaque' });
    await assert.rejects(insert(f, { provider: 'SEPAY', blocker: 'LEGACY_RECONCILIATION_REQUIRED', scope: null, trans: 'opaque' }), /ck_gateway_checkout_trans/);
    for (const trans of ['', ' ', 'x'.repeat(256)]) {
      await assert.rejects(insert(f, { provider: 'SEPAY', snapshot: sepaySnapshot, trans }), /ck_gateway_checkout_trans/);
    }
    const latestBeforeRollback = (await f.client.query('SELECT name FROM schema_migrations ORDER BY id DESC LIMIT 1')).rows[0].name;
    if (latestBeforeRollback === '000007_sepay_production') await runMigrations('down', f.url);
    const before = (await f.client.query('SELECT * FROM gateway.gateway_checkouts ORDER BY checkout_id')).rows;
    const checksBefore = await constraints(f.client);
    const migrationsBefore = (await f.client.query('SELECT * FROM schema_migrations ORDER BY id')).rows;
    await assert.rejects(runMigrations('down', f.url), /Cannot roll back while DEMO checkout or history rows exist/);
    assert.deepEqual((await f.client.query('SELECT * FROM gateway.gateway_checkouts ORDER BY checkout_id')).rows, before);
    assert.deepEqual(await constraints(f.client), checksBefore);
    assert.deepEqual((await f.client.query('SELECT * FROM schema_migrations ORDER BY id')).rows, migrationsBefore);
    assert.equal((await queryCatalog(f.url)).tables.length, 29);
  } finally { await f.client.end(); await f.db.destroy(); }
});

test('000006 up and no-DEMO down/up preserve MOMO and SEPAY histories, payment links and exact prior constraints', async () => {
  const f = await fixture();
  try {
    let latest = (await f.client.query('SELECT name FROM schema_migrations ORDER BY id DESC LIMIT 1')).rows[0].name;
    if (latest === '000007_sepay_production') {
      await runMigrations('down', f.url);
      latest = (await f.client.query('SELECT name FROM schema_migrations ORDER BY id DESC LIMIT 1')).rows[0].name;
    }
    if (latest === '000006_demo_gateway') await runMigrations('down', f.url);
    assert.equal((await f.client.query('SELECT name FROM schema_migrations ORDER BY id DESC LIMIT 1')).rows[0].name, '000005_optional_sepay_gateway');
    const prior = await constraints(f.client);
    const triggerBefore = (await f.client.query("SELECT pg_get_functiondef('gateway.preserve_checkout_intent()'::regprocedure) AS definition")).rows;
    for (const provider of ['MOMO', 'SEPAY']) {
      await insert(f, { provider, blocker: 'LEGACY_RECONCILIATION_REQUIRED' });
      for (const status of ['INITIATED', 'CREATED', 'SUCCEEDED']) {
        const paymentId = status === 'SUCCEEDED' ? randomUUID() : null;
        if (paymentId) await f.finance.insertPayment({ paymentId, tenancyId: f.ids.tenancy, amount: '1000.00', source: 'GATEWAY', verification: 'PROVIDER_VERIFIED', confirmedAt: '2026-10-07T00:00:00.000Z', voidedOrReversedAt: null, correctionNote: null, replacementPaymentId: null });
        await insert(f, { provider, snapshot: provider === 'MOMO' ? new HttpMomoPaymentClient(TEST_MOMO).snapshot('preserved') : sepaySnapshot,
          status, payment: paymentId, trans: paymentId ? (provider === 'MOMO' ? '42' : 'opaque-settlement') : null,
          stage: paymentId ? 'PAYMENT_IPN' : 'CREATE', remote: provider === 'SEPAY' ? randomUUID() : null });
      }
    }
    const before = (await f.client.query('SELECT * FROM gateway.gateway_checkouts ORDER BY checkout_id')).rows;
    const payments = (await f.client.query('SELECT * FROM public.payments ORDER BY payment_id')).rows;
    assert.equal(before.length, 8);
    await runMigrations('up', f.url);
    assert.equal((await f.client.query('SELECT name FROM schema_migrations ORDER BY id DESC LIMIT 1')).rows[0].name, '000007_sepay_production');
    const changed = new Set(['ck_gateway_checkouts_provider', 'ck_gateway_checkout_snapshot', 'ck_gateway_checkout_trans', 'ck_gateway_checkout_stage', 'ck_gateway_checkout_legacy']);
    assert.deepEqual((await constraints(f.client)).filter((row) => !changed.has(row.conname)), prior.filter((row) => !changed.has(row.conname)));
    assert.deepEqual((await f.client.query("SELECT pg_get_functiondef('gateway.preserve_checkout_intent()'::regprocedure) AS definition")).rows, triggerBefore);
    assert.deepEqual((await f.client.query('SELECT * FROM gateway.gateway_checkouts ORDER BY checkout_id')).rows, before);
    await runMigrations('down', f.url);
    await runMigrations('down', f.url);
    assert.deepEqual(await constraints(f.client), prior);
    assert.deepEqual((await f.client.query('SELECT * FROM gateway.gateway_checkouts ORDER BY checkout_id')).rows, before);
    await runMigrations('up', f.url);
    await runMigrations('up', f.url);
    assert.deepEqual((await f.client.query('SELECT * FROM gateway.gateway_checkouts ORDER BY checkout_id')).rows, before);
    assert.deepEqual((await f.client.query('SELECT * FROM public.payments ORDER BY payment_id')).rows, payments);
    assert.equal((await queryCatalog(f.url)).tables.length, 29);
  } finally { await f.client.end(); await f.db.destroy(); }
});

test('down refuses DEMO_CONFIRMATION history even without a DEMO provider row', async () => {
  const f = await fixture();
  try {
    await f.client.query('BEGIN');
    // Model imported history with a missing provider binding; roll back this fixture-only constraint removal.
    await f.client.query('ALTER TABLE gateway.gateway_checkouts DROP CONSTRAINT ck_gateway_checkout_stage');
    await insert(f, { provider: 'MOMO', blocker: 'LEGACY_RECONCILIATION_REQUIRED', stage: 'DEMO_CONFIRMATION' });
    const before = await constraints(f.client);
    await f.client.query('SAVEPOINT refusal');
    await assert.rejects(f.client.query(readFileSync('database/migrations/sql/000006_demo_gateway.down.sql', 'utf8')), /Cannot roll back while DEMO checkout or history rows exist/);
    await f.client.query('ROLLBACK TO SAVEPOINT refusal');
    assert.deepEqual(await constraints(f.client), before);
    assert.equal((await f.client.query("SELECT count(*)::int AS n FROM gateway.gateway_checkouts WHERE provider_outcome_stage='DEMO_CONFIRMATION'")).rows[0].n, 1);
  } finally { await f.client.query('ROLLBACK'); await f.client.end(); await f.db.destroy(); }
});

test('production sepay snapshot is stored once, keeps its invoice, and blocks rollback', async () => {
  const f = await fixture();
  try {
    assert.equal((await f.client.query('SELECT name FROM schema_migrations ORDER BY id DESC LIMIT 1')).rows[0].name, '000007_sepay_production');
    const snapshot = {
      environment: 'production', merchantId: 'MERCHANT', endpoint: 'https://pay.sepay.vn/v1/checkout/init',
      apiOrigin: 'https://pgapi.sepay.vn', operation: 'PURCHASE', paymentMethod: 'BANK_TRANSFER', currency: 'VND',
      successUrl: 'https://merchant.example/success', errorUrl: 'https://merchant.example/error', cancelUrl: 'https://merchant.example/cancel',
    };
    const id = await insert(f, { provider: 'SEPAY', snapshot, scope: 'production:MERCHANT' });
    const stored = (await f.client.query('SELECT idempotency_key, provider_order_id FROM gateway.gateway_checkouts WHERE checkout_id=$1', [id])).rows[0];
    await assert.rejects(f.client.query(`INSERT INTO gateway.gateway_checkouts
      (checkout_id,tenancy_id,created_by_user_id,amount,reference_code,provider,provider_order_id,provider_request_id,
       status,created_at,updated_at,idempotency_key,fingerprint,request_snapshot,provider_partner_code)
      VALUES ($1,$2,$3,1000,'again','SEPAY','other-invoice','other-request','CREATED',now(),now(),$4,'storage-fingerprint',$5::jsonb,'production:MERCHANT')`,
      [randomUUID(), f.ids.tenancy, f.ids.creator, stored.idempotency_key, JSON.stringify(snapshot)]), /uq_gateway_checkout_client_key/);
    await assert.rejects(f.client.query('UPDATE gateway.gateway_checkouts SET provider_order_id=$2 WHERE checkout_id=$1', [id, 'changed-invoice']), /immutable/);
    await assert.rejects(insert(f, { provider: 'SEPAY', snapshot: { ...snapshot, endpoint: 'https://pay-sandbox.sepay.vn/v1/checkout/init' }, scope: 'production:MERCHANT' }), /ck_gateway_checkout_snapshot/);
    await assert.rejects(insert(f, { provider: 'SEPAY', snapshot, scope: 'sandbox:MERCHANT' }), /ck_gateway_checkout_snapshot/);
    await assert.rejects(insert(f, { provider: 'SEPAY', snapshot: { ...snapshot, secretKey: 'hidden' }, scope: 'production:MERCHANT' }), /ck_gateway_checkout_snapshot/);
    await assert.rejects(insert(f, { provider: 'SEPAY', snapshot, scope: 'production:MERCHANT', trans: ' ' }), /ck_gateway_checkout_trans/);
    const before = (await f.client.query('SELECT * FROM gateway.gateway_checkouts ORDER BY checkout_id')).rows;
    await assert.rejects(runMigrations('down', f.url), /Cannot roll back while SePay production checkout rows exist/);
    assert.deepEqual((await f.client.query('SELECT * FROM gateway.gateway_checkouts ORDER BY checkout_id')).rows, before);
    assert.equal((await f.client.query('SELECT name FROM schema_migrations ORDER BY id DESC LIMIT 1')).rows[0].name, '000007_sepay_production');
  } finally { await f.client.end(); await f.db.destroy(); }
});
