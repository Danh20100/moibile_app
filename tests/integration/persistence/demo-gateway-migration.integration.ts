import { paymentData, paymentSql } from '../../support/payment-fixtures';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Client } from 'pg';

import { paymentMigrationPrefix } from './support/payment-migration-prefix';
import { HttpMomoPaymentClient } from '../../../src/modules/payment-gateway/momo/momo-client';
import { gatewayFixture, TEST_MOMO } from './gateway-test-support';
import { queryCatalog } from './support/postgres-test-harness';

const sepaySnapshot = {
  environment: paymentData.values.sandbox,
  merchantId: paymentData.values.TEST,
  endpoint: paymentData.values.https_pay_sandbox_sepay_vn_v1_checkout_init,
  apiOrigin: paymentData.values.https_pgapi_sandbox_sepay_vn,
  operation: paymentData.values.PURCHASE,
  paymentMethod: paymentData.values.BANK_TRANSFER,
  currency: paymentData.values.VND,
  successUrl: paymentData.values.https_merchant_example_success,
  errorUrl: paymentData.values.https_merchant_example_error,
  cancelUrl: paymentData.values.https_merchant_example_cancel,
};

async function fixture(prefix = '000006_demo_gateway') {
  const url = process.env.TEST_DATABASE_URL;
  assert.ok(url, 'TEST_DATABASE_URL required');
  const parsed = new URL(url);
  assert.equal(decodeURIComponent(parsed.pathname.slice(1)), paymentData.values.trooi_test);
  assert.ok(
    ([paymentData.values.localhost, paymentData.values.v_127_0_0_1] as string[]).includes(
      parsed.hostname,
    ),
  );
  assert.equal(parsed.port, paymentData.values.v_55433);
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    assert.equal(
      (await client.query('SELECT current_database() AS name')).rows[0].name,
      paymentData.values.trooi_test,
    );
    const f = await gatewayFixture(url, prefix);
    return { ...f, client, url };
  } catch (error) {
    await client.end();
    throw error;
  }
}

type Fixture = Awaited<ReturnType<typeof fixture>>;
async function insert(
  f: Fixture,
  input: {
    id?: string;
    provider?: string;
    snapshot?: object | null;
    stage?: string | null;
    trans?: string | null;
    blocker?: string | null;
    scope?: string | null;
    status?: string;
    payment?: string | null;
    remote?: string | null;
  } = {},
) {
  const id = input.id ?? f.nextId();
  const provider = input.provider ?? paymentData.values.DEMO;
  await f.client.query(
    `INSERT INTO gateway.gateway_checkouts
    (checkout_id,tenancy_id,created_by_user_id,amount,reference_code,provider,provider_order_id,provider_request_id,
     status,created_at,updated_at,idempotency_key,fingerprint,request_snapshot,provider_partner_code,
     provider_outcome_stage,provider_trans_id,replay_blocker,resulting_payment_id,provider_remote_order_id)
    VALUES ($1,$2,$3,${paymentData.numbers.amountVnd},${paymentSql(paymentData.values.storage_fixture)},$4,$5,$6,$7,${paymentSql(paymentData.values.v_2026_10_07T03_00_00_000Z)}::timestamptz,${paymentSql(paymentData.values.v_2026_10_07T03_00_00_000Z)}::timestamptz,$8,${paymentSql(paymentData.values.storage_fingerprint)},$9::jsonb,$10,$11,$12,$13,$14,$15)`,
    [
      id,
      f.ids.tenancy,
      f.ids.creator,
      provider,
      `invoice-${id}`,
      `request-${id}`,
      input.status ?? paymentData.values.CREATED,
      f.nextId(),
      input.snapshot == null ? null : JSON.stringify(input.snapshot),
      input.scope === undefined
        ? provider === paymentData.values.DEMO
          ? paymentData.values.demo_local
          : provider === paymentData.values.MOMO
            ? paymentData.values.TEST
            : paymentData.values.sandbox_TEST
        : input.scope,
      input.stage ?? null,
      input.trans ?? null,
      input.blocker ?? null,
      input.payment ?? null,
      input.remote ?? null,
    ],
  );
  return id;
}

async function constraints(client: Client) {
  return (
    await client.query(`SELECT conname,pg_get_constraintdef(oid) AS definition FROM pg_constraint
    WHERE conrelid='gateway.gateway_checkouts'::regclass ORDER BY conname`)
  ).rows;
}

test('DEMO null snapshot without legacy blocker, exact transaction identity and provider stages are enforced; down refuses history before DDL', async () => {
  const f = await fixture();
  try {
    const id = paymentData.values.d0000000_0000_4000_8000_000000000001;
    await insert(f, {
      id,
      stage: paymentData.values.DEMO_CONFIRMATION,
      trans: paymentData.values.DEMO_d0000000000040008000000000000001,
    });
    const demo = await f.finance.findGatewayCheckout(id);
    assert.equal(demo?.requestSnapshot, null);
    assert.equal(demo?.replayBlocker, null);
    await insert(f, { stage: paymentData.values.CREATE });
    await insert(f);
    for (const snapshot of [
      {},
      sepaySnapshot,
      new HttpMomoPaymentClient(TEST_MOMO).snapshot(paymentData.values.demo),
    ]) {
      await assert.rejects(insert(f, { snapshot }), /ck_gateway_checkout_(snapshot|legacy)/);
    }
    for (const stage of [
      paymentData.values.PAYMENT_IPN,
      paymentData.values.RECONCILIATION,
      paymentData.values.OTHER,
    ]) {
      await assert.rejects(insert(f, { stage }), /ck_gateway_checkout_stage/);
    }
    for (const trans of [
      paymentData.values.DEMO_arbitrary,
      paymentData.values.v_123,
      paymentData.values.DEMO_d0000000000040008000000000000001,
      '',
      paymentData.values.empty,
    ]) {
      await assert.rejects(insert(f, { trans }), /ck_gateway_checkout_trans/);
    }
    await assert.rejects(
      insert(f, { remote: paymentData.values.opaque }),
      /ck_gateway_checkout_remote/,
    );
    for (const provider of [paymentData.values.MOMO, paymentData.values.SEPAY]) {
      await assert.rejects(insert(f, { provider }), /ck_gateway_checkout_legacy/);
      const legacyId = await insert(f, {
        provider,
        blocker: paymentData.values.LEGACY_RECONCILIATION_REQUIRED,
      });
      assert.equal((await f.finance.findGatewayCheckout(legacyId))?.requestSnapshot, null);
      await assert.rejects(
        insert(f, {
          provider,
          blocker: paymentData.values.LEGACY_RECONCILIATION_REQUIRED,
          stage: paymentData.values.DEMO_CONFIRMATION,
        }),
        /ck_gateway_checkout_stage/,
      );
    }
    const momo = new HttpMomoPaymentClient(TEST_MOMO).snapshot(paymentData.values.momo);
    await insert(f, {
      provider: paymentData.values.MOMO,
      snapshot: momo,
      trans: paymentData.values.v_123,
    });
    await assert.rejects(
      insert(f, {
        provider: paymentData.values.MOMO,
        snapshot: momo,
        trans: paymentData.values.opaque,
      }),
      /ck_gateway_checkout_trans/,
    );
    await assert.rejects(
      insert(f, {
        provider: paymentData.values.MOMO,
        snapshot: momo,
        trans: paymentData.values.v_123,
      }),
      /uq_gateway_checkout_provider_trans/,
    );
    await insert(f, {
      provider: paymentData.values.SEPAY,
      snapshot: sepaySnapshot,
      trans: paymentData.values.opaque,
    });
    await assert.rejects(
      insert(f, {
        provider: paymentData.values.SEPAY,
        snapshot: sepaySnapshot,
        trans: paymentData.values.opaque,
      }),
      /uq_gateway_checkout_provider_trans/,
    );
    await insert(f, {
      provider: paymentData.values.SEPAY,
      snapshot: { ...sepaySnapshot, merchantId: paymentData.values.OTHER },
      scope: paymentData.values.sandbox_OTHER,
      trans: paymentData.values.opaque,
    });
    await assert.rejects(
      insert(f, {
        provider: paymentData.values.SEPAY,
        blocker: paymentData.values.LEGACY_RECONCILIATION_REQUIRED,
        scope: null,
        trans: paymentData.values.opaque,
      }),
      /ck_gateway_checkout_trans/,
    );
    for (const trans of [
      '',
      paymentData.values.empty,
      paymentData.values.x.repeat(paymentData.numbers.invalidLength),
    ]) {
      await assert.rejects(
        insert(f, { provider: paymentData.values.SEPAY, snapshot: sepaySnapshot, trans }),
        /ck_gateway_checkout_trans/,
      );
    }
    const before = (
      await f.client.query('SELECT * FROM gateway.gateway_checkouts ORDER BY checkout_id')
    ).rows;
    const checksBefore = await constraints(f.client);
    const migrationsBefore = (await f.client.query('SELECT * FROM schema_migrations ORDER BY id'))
      .rows;
    await assert.rejects(
      paymentMigrationPrefix(f.url, '000005_optional_sepay_gateway'),
      /Cannot roll back while DEMO checkout or history rows exist/,
    );
    assert.deepEqual(
      (await f.client.query('SELECT * FROM gateway.gateway_checkouts ORDER BY checkout_id')).rows,
      before,
    );
    assert.deepEqual(await constraints(f.client), checksBefore);
    assert.deepEqual(
      (await f.client.query('SELECT * FROM schema_migrations ORDER BY id')).rows,
      migrationsBefore,
    );
    assert.equal((await queryCatalog(f.url)).tables.length, paymentData.numbers.frozenV1TableCount);
  } finally {
    await f.client.end();
    await f.db.destroy();
  }
});

test('000006 up and no-DEMO down/up preserve MOMO and SEPAY histories, payment links and exact prior constraints', async () => {
  const f = await fixture();
  try {
    await paymentMigrationPrefix(f.url, '000005_optional_sepay_gateway');
    assert.equal(
      (await f.client.query('SELECT name FROM schema_migrations ORDER BY id DESC LIMIT 1')).rows[0]
        .name,
      '000005_optional_sepay_gateway',
    );
    const prior = await constraints(f.client);
    const triggerBefore = (
      await f.client.query(
        "SELECT pg_get_functiondef('gateway.preserve_checkout_intent()'::regprocedure) AS definition",
      )
    ).rows;
    for (const provider of [paymentData.values.MOMO, paymentData.values.SEPAY]) {
      await insert(f, { provider, blocker: paymentData.values.LEGACY_RECONCILIATION_REQUIRED });
      for (const status of [
        paymentData.values.INITIATED,
        paymentData.values.CREATED,
        paymentData.values.SUCCEEDED,
      ]) {
        const paymentId = status === paymentData.values.SUCCEEDED ? f.nextId() : null;
        if (paymentId)
          await f.finance.insertPayment({
            paymentId,
            tenancyId: f.ids.tenancy,
            amount: paymentData.values.v_1000_00,
            source: paymentData.values.GATEWAY,
            verification: paymentData.values.PROVIDER_VERIFIED,
            confirmedAt: paymentData.values.v_2026_10_07T00_00_00_000Z,
            voidedOrReversedAt: null,
            correctionNote: null,
            replacementPaymentId: null,
          });
        await insert(f, {
          provider,
          snapshot:
            provider === paymentData.values.MOMO
              ? new HttpMomoPaymentClient(TEST_MOMO).snapshot(paymentData.values.preserved)
              : sepaySnapshot,
          status,
          payment: paymentId,
          trans: paymentId
            ? provider === paymentData.values.MOMO
              ? paymentData.values.v_42
              : paymentData.values.opaque_settlement
            : null,
          stage: paymentId ? paymentData.values.PAYMENT_IPN : paymentData.values.CREATE,
          remote: provider === paymentData.values.SEPAY ? f.nextId() : null,
        });
      }
    }
    const before = (
      await f.client.query('SELECT * FROM gateway.gateway_checkouts ORDER BY checkout_id')
    ).rows;
    const payments = (await f.client.query('SELECT * FROM public.payments ORDER BY payment_id'))
      .rows;
    assert.equal(before.length, paymentData.numbers.expectedCount8);
    await paymentMigrationPrefix(f.url, '000006_demo_gateway');
    assert.equal(
      (await f.client.query('SELECT name FROM schema_migrations ORDER BY id DESC LIMIT 1')).rows[0]
        .name,
      '000006_demo_gateway',
    );
    const changed = new Set([
      'ck_gateway_checkouts_provider',
      'ck_gateway_checkout_snapshot',
      'ck_gateway_checkout_trans',
      'ck_gateway_checkout_stage',
      'ck_gateway_checkout_legacy',
    ]);
    assert.deepEqual(
      (await constraints(f.client)).filter((row) => !changed.has(row.conname)),
      prior.filter((row) => !changed.has(row.conname)),
    );
    assert.deepEqual(
      (
        await f.client.query(
          "SELECT pg_get_functiondef('gateway.preserve_checkout_intent()'::regprocedure) AS definition",
        )
      ).rows,
      triggerBefore,
    );
    assert.deepEqual(
      (await f.client.query('SELECT * FROM gateway.gateway_checkouts ORDER BY checkout_id')).rows,
      before,
    );
    await paymentMigrationPrefix(f.url, '000005_optional_sepay_gateway');
    assert.deepEqual(await constraints(f.client), prior);
    assert.deepEqual(
      (await f.client.query('SELECT * FROM gateway.gateway_checkouts ORDER BY checkout_id')).rows,
      before,
    );
    await paymentMigrationPrefix(f.url, '000006_demo_gateway');
    assert.deepEqual(
      (await f.client.query('SELECT * FROM gateway.gateway_checkouts ORDER BY checkout_id')).rows,
      before,
    );
    assert.deepEqual(
      (await f.client.query('SELECT * FROM public.payments ORDER BY payment_id')).rows,
      payments,
    );
    assert.equal((await queryCatalog(f.url)).tables.length, paymentData.numbers.frozenV1TableCount);
  } finally {
    await f.client.end();
    await f.db.destroy();
  }
});

test('down refuses DEMO_CONFIRMATION history even without a DEMO provider row', async () => {
  const f = await fixture();
  try {
    await f.client.query('BEGIN');
    // Model imported history with a missing provider binding; roll back this fixture-only constraint removal.
    await f.client.query(
      'ALTER TABLE gateway.gateway_checkouts DROP CONSTRAINT ck_gateway_checkout_stage',
    );
    await insert(f, {
      provider: paymentData.values.MOMO,
      blocker: paymentData.values.LEGACY_RECONCILIATION_REQUIRED,
      stage: paymentData.values.DEMO_CONFIRMATION,
    });
    const before = await constraints(f.client);
    await f.client.query('SAVEPOINT refusal');
    await assert.rejects(
      f.client.query(
        readFileSync(
          paymentData.values.database_migrations_sql_000006_demo_gateway_down_sql,
          'utf8',
        ),
      ),
      /Cannot roll back while DEMO checkout or history rows exist/,
    );
    await f.client.query('ROLLBACK TO SAVEPOINT refusal');
    assert.deepEqual(await constraints(f.client), before);
    assert.equal(
      (
        await f.client.query(
          "SELECT count(*)::int AS n FROM gateway.gateway_checkouts WHERE provider_outcome_stage='DEMO_CONFIRMATION'",
        )
      ).rows[0].n,
      paymentData.numbers.expectedCount1,
    );
  } finally {
    await f.client.query('ROLLBACK');
    await f.client.end();
    await f.db.destroy();
  }
});

test('production sepay snapshot is stored once, keeps its invoice, and blocks rollback', async () => {
  const f = await fixture('000007_sepay_production');
  try {
    assert.equal(
      (await f.client.query('SELECT name FROM schema_migrations ORDER BY id DESC LIMIT 1')).rows[0]
        .name,
      '000007_sepay_production',
    );
    const snapshot = {
      environment: paymentData.values.production,
      merchantId: paymentData.values.MERCHANT,
      endpoint: paymentData.values.https_pay_sepay_vn_v1_checkout_init,
      apiOrigin: paymentData.values.https_pgapi_sepay_vn,
      operation: paymentData.values.PURCHASE,
      paymentMethod: paymentData.values.BANK_TRANSFER,
      currency: paymentData.values.VND,
      successUrl: paymentData.values.https_merchant_example_success,
      errorUrl: paymentData.values.https_merchant_example_error,
      cancelUrl: paymentData.values.https_merchant_example_cancel,
    };
    const id = await insert(f, {
      provider: paymentData.values.SEPAY,
      snapshot,
      scope: paymentData.values.production_MERCHANT,
    });
    const stored = (
      await f.client.query(
        'SELECT idempotency_key, provider_order_id FROM gateway.gateway_checkouts WHERE checkout_id=$1',
        [id],
      )
    ).rows[0];
    await assert.rejects(
      f.client.query(
        `INSERT INTO gateway.gateway_checkouts
      (checkout_id,tenancy_id,created_by_user_id,amount,reference_code,provider,provider_order_id,provider_request_id,
       status,created_at,updated_at,idempotency_key,fingerprint,request_snapshot,provider_partner_code)
      VALUES ($1,$2,$3,${paymentData.numbers.amountVnd},${paymentSql(paymentData.values.again)},${paymentSql(paymentData.values.SEPAY)},${paymentSql(paymentData.values.other_invoice)},${paymentSql(paymentData.values.other_request)},${paymentSql(paymentData.values.CREATED)},${paymentSql(paymentData.values.v_2026_10_07T03_00_00_000Z)}::timestamptz,${paymentSql(paymentData.values.v_2026_10_07T03_00_00_000Z)}::timestamptz,$4,${paymentSql(paymentData.values.storage_fingerprint)},$5::jsonb,${paymentSql(paymentData.values.production_MERCHANT)})`,
        [
          f.nextId(),
          f.ids.tenancy,
          f.ids.creator,
          stored.idempotency_key,
          JSON.stringify(snapshot),
        ],
      ),
      /uq_gateway_checkout_client_key/,
    );
    await assert.rejects(
      f.client.query(
        `UPDATE gateway.gateway_checkouts SET provider_order_id=$2 WHERE checkout_id=$1`,
        [id, paymentData.values.changed_invoice],
      ),
      /immutable/,
    );
    await assert.rejects(
      insert(f, {
        provider: paymentData.values.SEPAY,
        snapshot: {
          ...snapshot,
          endpoint: paymentData.values.https_pay_sandbox_sepay_vn_v1_checkout_init,
        },
        scope: paymentData.values.production_MERCHANT,
      }),
      /ck_gateway_checkout_snapshot/,
    );
    await assert.rejects(
      insert(f, {
        provider: paymentData.values.SEPAY,
        snapshot,
        scope: paymentData.values.sandbox_MERCHANT,
      }),
      /ck_gateway_checkout_snapshot/,
    );
    await assert.rejects(
      insert(f, {
        provider: paymentData.values.SEPAY,
        snapshot: { ...snapshot, secretKey: paymentData.values.hidden },
        scope: paymentData.values.production_MERCHANT,
      }),
      /ck_gateway_checkout_snapshot/,
    );
    await assert.rejects(
      insert(f, {
        provider: paymentData.values.SEPAY,
        snapshot,
        scope: paymentData.values.production_MERCHANT,
        trans: paymentData.values.empty,
      }),
      /ck_gateway_checkout_trans/,
    );
    const before = (
      await f.client.query('SELECT * FROM gateway.gateway_checkouts ORDER BY checkout_id')
    ).rows;
    await assert.rejects(
      paymentMigrationPrefix(f.url, '000006_demo_gateway'),
      /Cannot roll back while SePay production checkout rows exist/,
    );
    assert.deepEqual(
      (await f.client.query('SELECT * FROM gateway.gateway_checkouts ORDER BY checkout_id')).rows,
      before,
    );
    assert.equal(
      (await f.client.query('SELECT name FROM schema_migrations ORDER BY id DESC LIMIT 1')).rows[0]
        .name,
      '000007_sepay_production',
    );
  } finally {
    await f.client.end();
    await f.db.destroy();
  }
});
