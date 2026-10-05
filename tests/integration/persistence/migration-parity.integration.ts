import type { TransactionManager } from '../../../src/persistence/ports/transaction-manager';
import { HttpMomoPaymentClient } from '../../../src/modules/payment-gateway/momo/momo-client';
import { TenancyService } from '../../../src/modules/tenancy/services/tenancy.service';
import { PaymentGatewayService } from '../../../src/modules/payment-gateway/services/payment-gateway.service';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { Client } from 'pg';

import { runMigrations } from '../../../scripts/database/migrate';
import { gatewayFixture } from './gateway-test-support';
import { queryCatalog, resetPublicSchema } from './support/postgres-test-harness';

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
      ? existsSync(
          join(process.env.LOCALAPPDATA ?? '', 'Programs', 'Python', 'Python310', 'python.exe'),
        )
        ? join(process.env.LOCALAPPDATA ?? '', 'Programs', 'Python', 'Python310', 'python.exe')
        : 'py'
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
    assert.equal(verification.status, 0, `${verification.stdout}${verification.stderr}`);
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
      assert.equal(
        (await repositories.organization?.findOrganization(f.ids.org))?.primaryOwnerUserId,
        f.ids.creator,
      );
      assert.equal((await repositories.finance.findCharge(f.ids.charge))?.amount, '1000.00');
      assert.equal((await repositories.finance.findPaymentsForTenancy(f.ids.tenancy)).length, 0);
    });
    assert.deepEqual(await f.notifications.findNotificationsByRecipient(f.ids.recipient), []);
  } finally {
    await f.db.destroy();
  }
});

test('durability migration preserves legacy IDs/results and blocks unreconstructible replay', async () => {
  const url = process.env.TEST_DATABASE_URL;
  assert.ok(url);
  const f = await gatewayFixture(url);
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await runMigrations('down', url);
    const catalog = await client.query('SELECT name FROM schema_migrations ORDER BY id');
    assert.deepEqual(
      catalog.rows.map((row) => row.name),
      ['000001_initial_schema', '000002_prepare_initial_rollback', '000003_gateway_checkouts'],
    );
    const paymentId = '92000000-0000-4000-8000-000000000001';
    await f.finance.insertPayment({
      paymentId,
      tenancyId: f.ids.tenancy,
      amount: '1000.00',
      source: 'GATEWAY',
      verification: 'PROVIDER_VERIFIED',
      confirmedAt: '2026-10-05T00:00:00.000Z',
      voidedOrReversedAt: null,
      correctionNote: null,
      replacementPaymentId: null,
    });
    const ids = ['93000000-0000-4000-8000-000000000001', '93000000-0000-4000-8000-000000000002'];
    for (let i = 0; i < ids.length; i++) {
      await client.query(
        `INSERT INTO gateway.gateway_checkouts
        (checkout_id,tenancy_id,created_by_user_id,amount,reference_code,provider,provider_order_id,provider_request_id,status,resulting_payment_id,created_at,updated_at)
        VALUES ($1,$2,$3,1000,'legacy','MOMO',$4,$5,$6,$7,now(),now())`,
        [
          ids[i],
          f.ids.tenancy,
          f.ids.creator,
          `legacy-order-${i}`,
          `legacy-request-${i}`,
          i ? 'SUCCEEDED' : 'CREATED',
          i ? paymentId : null,
        ],
      );
    }
    await runMigrations('up', url);
    const rows = (
      await client.query('SELECT * FROM gateway.gateway_checkouts ORDER BY checkout_id')
    ).rows;
    assert.equal(rows[0].checkout_id, ids[0]);
    assert.equal(rows[0].provider_order_id, 'legacy-order-0');
    assert.equal(rows[0].provider_request_id, 'legacy-request-0');
    assert.equal(rows[0].status, 'CREATED');
    assert.equal(rows[0].replay_blocker, 'LEGACY_RECONCILIATION_REQUIRED');
    assert.equal(rows[0].request_snapshot, null);
    assert.equal(rows[0].provider_partner_code, null);
    assert.equal(rows[1].status, 'SUCCEEDED');
    assert.equal(rows[1].resulting_payment_id, paymentId);
    await runMigrations('up', url);
    assert.equal(
      (await client.query('SELECT count(*)::int AS count FROM gateway.gateway_checkouts')).rows[0]
        .count,
      2,
    );
    await runMigrations('down', url);
    await runMigrations('up', url);
    assert.equal((await f.finance.findGatewayCheckout(ids[1]!))?.resultingPaymentId, paymentId);
  } finally {
    await client.end();
    await f.db.destroy();
  }
});

test('PostgreSQL dispatch sees committed intent and lease, releases locks, and elects one same-key caller', async () => {
  const url = process.env.TEST_DATABASE_URL;
  assert.ok(url);
  const f = await gatewayFixture(url);
  const client = new Client({ connectionString: url });
  await client.connect();
  const protocol = new HttpMomoPaymentClient({
    partnerCode: 'TEST',
    accessKey: 'test',
    secretKey: 'test',
    endpoint: 'https://test-payment.momo.vn',
    ipnUrl: 'https://example.test/ipn',
    redirectUrl: 'trooi://payment/momo',
  });
  let calls = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let entered!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const gateway = new PaymentGatewayService(new TenancyService(f.manager), f.manager, {
    snapshot: (id) => protocol.snapshot(id),
    verifyIpn: () => false,
    async createCaptureWallet(input) {
      calls++;
      if (calls > 1)
        return {
          resultCode: 0,
          message: 'ok',
          payUrl: 'https://test-payment.momo.vn/pay',
          deeplink: null,
        };
      const stored = (
        await client.query('SELECT * FROM gateway.gateway_checkouts WHERE provider_order_id=$1', [
          input.orderId,
        ])
      ).rows[0];
      assert.ok(stored, 'separate connection must see committed intent');
      assert.ok(stored.dispatch_lease_owner, 'separate connection must see committed lease');
      assert.ok(stored.first_dispatch_at);
      assert.equal(stored.provider_request_id, input.requestId);
      assert.deepEqual(stored.request_snapshot, input.snapshot);
      await client.query('BEGIN');
      try {
        await client.query(
          'SELECT checkout_id FROM gateway.gateway_checkouts WHERE checkout_id=$1 FOR UPDATE NOWAIT',
          [stored.checkout_id],
        );
      } finally {
        await client.query('ROLLBACK');
      }
      entered();
      await gate;
      return {
        resultCode: 0,
        message: 'ok',
        payUrl: 'https://test-payment.momo.vn/pay',
        deeplink: null,
      };
    },
  });
  try {
    const key = randomUUID();
    const first = gateway.createCheckout(
      { tenancyId: f.ids.tenancy, amount: '1000' },
      f.ids.creator,
      key,
    );
    await Promise.race([
      started,
      first.then(() => {
        throw new Error('provider observation failed before barrier');
      }),
    ]);
    const attempts = [
      first,
      ...Array.from({ length: 7 }, () =>
        gateway.createCheckout({ tenancyId: f.ids.tenancy, amount: '1000' }, f.ids.creator, key),
      ),
    ];
    release();
    const results = await Promise.all(attempts);
    assert.equal(new Set(results.map((r) => r.id)).size, 1);
    assert.equal(calls, 1);
    const racingKey = randomUUID();
    const racing = await Promise.all(
      Array.from({ length: 8 }, () =>
        gateway.createCheckout(
          { tenancyId: f.ids.tenancy, amount: '1000' },
          f.ids.creator,
          racingKey,
        ),
      ),
    );
    assert.equal(new Set(racing.map((r) => r.id)).size, 1);
    assert.equal(calls, 2, 'simultaneous new intent race elects exactly one additional dispatcher');
    assert.equal((await f.finance.findPaymentsForTenancy(f.ids.tenancy)).length, 0);
    const id = results[0]!.id;
    await assert.rejects(
      client.query(
        'UPDATE gateway.gateway_checkouts SET provider_request_id=$1 WHERE checkout_id=$2',
        ['changed', id],
      ),
      /immutable/,
    );
    await assert.rejects(
      client.query("UPDATE gateway.gateway_checkouts SET status='SUCCEEDED' WHERE checkout_id=$1", [
        id,
      ]),
      /ck_gateway_checkout_result/,
    );
    const record = await f.finance.findGatewayCheckout(id);
    assert.ok(record);
    await assert.rejects(
      f.finance.insertGatewayCheckout({
        ...record,
        checkoutId: randomUUID(),
        idempotencyKey: randomUUID(),
        providerOrderId: randomUUID(),
      }),
      /unique constraint/,
    );
    await assert.rejects(
      f.finance.insertGatewayCheckout({
        ...record,
        checkoutId: randomUUID(),
        idempotencyKey: randomUUID(),
        providerOrderId: randomUUID(),
        providerRequestId: randomUUID(),
        amount: '1000.50',
      }),
      /check constraint/,
    );
  } finally {
    release();
    await client.end();
    await f.db.destroy();
  }
});

test('committed pre-HTTP crash lease recovers after 60s, and failed intent transaction dispatches nothing', async () => {
  const url = process.env.TEST_DATABASE_URL;
  assert.ok(url);
  const f = await gatewayFixture(url);
  let now = new Date('2026-10-05T00:00:00.000Z');
  let failure: 'INSERT' | 'AFTER_LEASE' | null = 'INSERT';
  const manager: TransactionManager = {
    async run(work) {
      let acquired = false;
      const result = await f.manager.run(async (context) => {
        const finance = context.repositories.finance;
        const insert = finance.insertGatewayCheckout.bind(finance);
        finance.insertGatewayCheckout = async (record) => {
          await insert(record);
          if (failure === 'INSERT') throw new Error('intent commit failure');
        };
        const lease = finance.acquireGatewayDispatchLease.bind(finance);
        finance.acquireGatewayDispatchLease = async (...args) => {
          acquired = await lease(...args);
          return acquired;
        };
        return work(context);
      });
      if (acquired && failure === 'AFTER_LEASE')
        throw new Error('process stopped after committed lease');
      return result;
    },
  };
  const protocol = new HttpMomoPaymentClient({
    partnerCode: 'TEST',
    accessKey: 'test',
    secretKey: 'test',
    endpoint: 'https://test-payment.momo.vn',
    ipnUrl: 'https://example.test/ipn',
    redirectUrl: 'trooi://payment/momo',
  });
  let calls = 0;
  const gateway = new PaymentGatewayService(
    new TenancyService(manager),
    manager,
    {
      snapshot: (id) => protocol.snapshot(id),
      verifyIpn: () => false,
      async createCaptureWallet() {
        calls++;
        return {
          resultCode: 0,
          message: 'ok',
          payUrl: 'https://test-payment.momo.vn/pay',
          deeplink: null,
        };
      },
    },
    undefined,
    () => now,
  );
  const input = { tenancyId: f.ids.tenancy, amount: '1000' };
  const key = randomUUID();
  try {
    await assert.rejects(
      gateway.createCheckout(input, f.ids.creator, key),
      /intent commit failure/,
    );
    assert.equal(await f.finance.findGatewayCheckoutByClientKey(f.ids.creator, key), undefined);
    assert.equal(calls, 0);
    failure = 'AFTER_LEASE';
    await assert.rejects(gateway.createCheckout(input, f.ids.creator, key), /process stopped/);
    const crashed = await f.finance.findGatewayCheckoutByClientKey(f.ids.creator, key);
    assert.ok(crashed?.dispatchLeaseOwner);
    assert.equal(calls, 0);
    failure = null;
    const waiting = await gateway.createCheckout(input, f.ids.creator, key);
    assert.equal(waiting.replayBlockedReason, 'DISPATCH_IN_PROGRESS');
    assert.equal(calls, 0);
    now = new Date(now.getTime() + 60000);
    const recovered = await gateway.createCheckout(input, f.ids.creator, key);
    assert.equal(recovered.id, crashed.checkoutId);
    assert.equal(recovered.status, 'CREATED');
    assert.equal(calls, 1);
    assert.equal(
      (await f.finance.findGatewayCheckout(recovered.id))?.providerRequestId,
      crashed.providerRequestId,
    );
    assert.equal((await f.finance.findPaymentsForTenancy(f.ids.tenancy)).length, 0);
  } finally {
    await f.db.destroy();
  }
});

test('gateway durability constraints remain at SQL level and public catalog stays 29', async () => {
  const url = process.env.TEST_DATABASE_URL;
  assert.ok(url);
  const f = await gatewayFixture(url);
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const uniques = await client.query<{ conname: string }>(
      `SELECT conname FROM pg_constraint
       WHERE conrelid = 'gateway.gateway_checkouts'::regclass AND contype = 'u'
       ORDER BY conname`,
    );
    assert.deepEqual(
      uniques.rows.map((row) => row.conname),
      [
        'uq_gateway_checkout_client_key',
        'uq_gateway_checkout_provider_order',
        'uq_gateway_checkout_provider_request',
        'uq_gateway_checkout_provider_trans',
        'uq_gateway_checkouts_provider_order',
        'uq_gateway_checkouts_resulting_payment',
      ],
    );
    const fks = await client.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM pg_constraint
       WHERE conrelid = 'gateway.gateway_checkouts'::regclass AND contype = 'f'`,
    );
    assert.equal(fks.rows[0]?.count, 2);
    const checks = await client.query<{ conname: string }>(
      `SELECT conname FROM pg_constraint
       WHERE conrelid = 'gateway.gateway_checkouts'::regclass AND contype = 'c'
         AND conname IN (
           'ck_gateway_checkout_result','ck_gateway_checkout_trans','ck_gateway_checkouts_status'
         )
       ORDER BY conname`,
    );
    assert.equal(checks.rows.length, 3);
    const catalog = await queryCatalog(url);
    assert.equal(catalog.tables.length, 29);
  } finally {
    await client.end();
    await f.db.destroy();
  }
});
