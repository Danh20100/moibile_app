import { paymentData, paymentSql } from '../../support/payment-fixtures';
import type { TransactionManager } from '../../../src/persistence/ports/transaction-manager';
import { HttpMomoPaymentClient } from '../../../src/modules/payment-gateway/momo/momo-client';
import { TenancyService } from '../../../src/modules/tenancy/services/tenancy.service';
import { PaymentGatewayService } from '../../../src/modules/payment-gateway/services/payment-gateway.service';
import { MomoGatewayAdapter } from '../../../src/modules/payment-gateway/providers/momo-gateway.adapter';
import { GatewayProviderRegistry } from '../../../src/modules/payment-gateway/providers/gateway-provider.registry';
import { GatewaySettlementService } from '../../../src/modules/payment-gateway/services/gateway-settlement.service';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { Client } from 'pg';

import { paymentMigrationPrefix } from './support/payment-migration-prefix';
import { gatewayFixture } from './gateway-test-support';
import { queryCatalog, resetPublicSchema } from './support/postgres-test-harness';

test('optional_sepay_upgrade_preserves_momo_rows', async () => {
  const url = process.env.TEST_DATABASE_URL;
  assert.ok(url);
  const f = await gatewayFixture(url, '000005_optional_sepay_gateway');
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await paymentMigrationPrefix(url, '000004_gateway_checkout_durability');
    assert.equal(
      (await client.query('SELECT name FROM schema_migrations ORDER BY id DESC LIMIT 1')).rows[0]
        ?.name,
      '000004_gateway_checkout_durability',
    );
    const protocol = new HttpMomoPaymentClient({
      partnerCode: paymentData.values.TEST,
      accessKey: paymentData.values.test,
      secretKey: paymentData.values.test,
      endpoint: paymentData.values.https_test_payment_momo_vn,
      ipnUrl: paymentData.values.https_example_test_ipn,
      redirectUrl: paymentData.values.trooi_payment_momo,
    });
    const paymentId = f.nextId();
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
    for (const status of [
      paymentData.values.INITIATED,
      paymentData.values.CREATED,
      paymentData.values.SUCCEEDED,
    ]) {
      const id = f.nextId();
      await client.query(
        `INSERT INTO gateway.gateway_checkouts
        (checkout_id,tenancy_id,created_by_user_id,amount,reference_code,provider,provider_order_id,provider_request_id,status,created_at,updated_at,idempotency_key,fingerprint,request_snapshot,provider_partner_code,resulting_payment_id,provider_trans_id)
        VALUES ($1,$2,$3,${paymentData.numbers.amountVnd},${paymentSql(paymentData.values.momo_preserved)},${paymentSql(paymentData.values.MOMO)},$4,$5,$6,${paymentSql(paymentData.values.v_2026_10_07T03_00_00_000Z)}::timestamptz,${paymentSql(paymentData.values.v_2026_10_07T03_00_00_000Z)}::timestamptz,$7,$8,$9::jsonb,${paymentSql(paymentData.values.TEST)},$10,$11)`,
        [
          id,
          f.ids.tenancy,
          f.ids.creator,
          status + paymentData.values.order,
          status + paymentData.values.request,
          status,
          f.nextId(),
          paymentData.values.v_6dedce75fb7bd88a7a40c3f7e473f29548994272dc47fe79b13ab2e17adbfdd4,
          JSON.stringify(protocol.snapshot(id)),
          status === paymentData.values.SUCCEEDED ? paymentId : null,
          status === paymentData.values.SUCCEEDED ? paymentData.values.v_123 : null,
        ],
      );
    }
    await client.query(
      `INSERT INTO gateway.gateway_checkouts (checkout_id,tenancy_id,created_by_user_id,amount,reference_code,provider,provider_order_id,provider_request_id,status,replay_blocker,created_at,updated_at)
      VALUES ($1,$2,$3,${paymentData.numbers.amountVnd},${paymentSql(paymentData.values.legacy)},${paymentSql(paymentData.values.MOMO)},${paymentSql(paymentData.values.legacy_order)},${paymentSql(paymentData.values.legacy_request)},${paymentSql(paymentData.values.CREATED)},${paymentSql(paymentData.values.LEGACY_RECONCILIATION_REQUIRED)},${paymentSql(paymentData.values.v_2026_10_07T03_00_00_000Z)}::timestamptz,${paymentSql(paymentData.values.v_2026_10_07T03_00_00_000Z)}::timestamptz)`,
      [f.nextId(), f.ids.tenancy, f.ids.creator],
    );
    const before = (
      await client.query('SELECT * FROM gateway.gateway_checkouts ORDER BY provider_order_id')
    ).rows;
    assert.equal(before.length, paymentData.numbers.expectedCount4);
    const paymentBefore = (
      await client.query('SELECT * FROM public.payments WHERE payment_id=$1', [paymentId])
    ).rows;
    assert.equal(paymentBefore.length, paymentData.numbers.expectedCount1);
    await paymentMigrationPrefix(url, '000005_optional_sepay_gateway');
    const after = (
      await client.query(
        'SELECT *,handoff_attempt,provider_remote_order_id,handoff_claimed_at FROM gateway.gateway_checkouts ORDER BY provider_order_id',
      )
    ).rows;
    assert.equal(after.length, before.length);
    assert.deepEqual(
      (await client.query('SELECT * FROM public.payments WHERE payment_id=$1', [paymentId])).rows,
      paymentBefore,
    );
    for (let i = 0; i < after.length; i++) {
      const { handoff_attempt, provider_remote_order_id, handoff_claimed_at, ...unchanged } =
        after[i];
      assert.deepEqual(unchanged, before[i]);
      assert.equal(handoff_attempt, paymentData.numbers.expectedCount0);
      assert.equal(provider_remote_order_id, null);
      assert.equal(handoff_claimed_at, null);
    }
    await paymentMigrationPrefix(url, '000005_optional_sepay_gateway');
    assert.deepEqual(
      (await client.query('SELECT * FROM gateway.gateway_checkouts ORDER BY provider_order_id'))
        .rows,
      after,
    );
    assert.equal((await queryCatalog(url)).tables.length, paymentData.numbers.frozenV1TableCount);
  } finally {
    await client.end();
    await f.db.destroy();
  }
});

// These are local storage invariants, not provider/API identity or acceptance fixtures.
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

test('momo_remote_order_id_is_rejected', async () => {
  const url = process.env.TEST_DATABASE_URL;
  assert.ok(url);
  const f = await gatewayFixture(url, '000005_optional_sepay_gateway');
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const id = f.nextId();
    await client.query(
      `INSERT INTO gateway.gateway_checkouts
      (checkout_id,tenancy_id,created_by_user_id,amount,reference_code,provider,provider_order_id,provider_request_id,status,replay_blocker,provider_partner_code,created_at,updated_at)
      VALUES ($1,$2,$3,${paymentData.numbers.amountVnd},${paymentSql(paymentData.values.legacy)},${paymentSql(paymentData.values.MOMO)},${paymentSql(paymentData.values.momo_invoice)},${paymentSql(paymentData.values.momo_request)},${paymentSql(paymentData.values.CREATED)},${paymentSql(paymentData.values.LEGACY_RECONCILIATION_REQUIRED)},${paymentSql(paymentData.values.TEST)},${paymentSql(paymentData.values.v_2026_10_07T03_00_00_000Z)}::timestamptz,${paymentSql(paymentData.values.v_2026_10_07T03_00_00_000Z)}::timestamptz)`,
      [id, f.ids.tenancy, f.ids.creator],
    );
    await assert.rejects(
      client.query(
        `UPDATE gateway.gateway_checkouts SET provider_remote_order_id=$1 WHERE checkout_id=$2`,
        [paymentData.values.opaque_remote, id],
      ),
      /ck_gateway_checkout_remote/,
    );
    await assert.rejects(
      client.query(
        `INSERT INTO gateway.gateway_checkouts
      (checkout_id,tenancy_id,created_by_user_id,amount,reference_code,provider,provider_order_id,provider_request_id,status,replay_blocker,provider_partner_code,provider_remote_order_id,created_at,updated_at)
      VALUES ($1,$2,$3,${paymentData.numbers.amountVnd},${paymentSql(paymentData.values.legacy)},${paymentSql(paymentData.values.MOMO)},${paymentSql(paymentData.values.other_momo_invoice)},${paymentSql(paymentData.values.other_momo_request)},${paymentSql(paymentData.values.CREATED)},${paymentSql(paymentData.values.LEGACY_RECONCILIATION_REQUIRED)},${paymentSql(paymentData.values.TEST)},${paymentSql(paymentData.values.opaque_remote)},${paymentSql(paymentData.values.v_2026_10_07T03_00_00_000Z)}::timestamptz,${paymentSql(paymentData.values.v_2026_10_07T03_00_00_000Z)}::timestamptz)`,
        [f.nextId(), f.ids.tenancy, f.ids.creator],
      ),
      /ck_gateway_checkout_remote/,
    );
    assert.equal((await f.finance.findGatewayCheckout(id))?.providerRemoteOrderId, null);
    assert.equal(
      await f.finance.findGatewayCheckoutByRemoteOrderId(
        paymentData.values.MOMO,
        paymentData.values.TEST,
        paymentData.values.opaque_remote,
      ),
      undefined,
    );
  } finally {
    await client.end();
    await f.db.destroy();
  }
});

test('sql_unknown_handoff_can_advance_without_authorizing_repository_resume', async () => {
  const url = process.env.TEST_DATABASE_URL;
  assert.ok(url);
  const f = await gatewayFixture(url, '000005_optional_sepay_gateway');
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const id = f.nextId();
    const first = paymentData.values.v_2026_10_07T01_00_00_000Z;
    const later = paymentData.values.v_2026_10_07T02_00_00_000Z;
    await client.query(
      `INSERT INTO gateway.gateway_checkouts
      (checkout_id,tenancy_id,created_by_user_id,amount,reference_code,provider,provider_order_id,provider_request_id,status,created_at,updated_at,idempotency_key,fingerprint,request_snapshot,provider_partner_code)
      VALUES ($1,$2,$3,${paymentData.numbers.amountVnd},${paymentSql(paymentData.values.handoff_storage)},${paymentSql(paymentData.values.SEPAY)},${paymentSql(paymentData.values.handoff_invoice)},${paymentSql(paymentData.values.handoff_request)},${paymentSql(paymentData.values.CREATED)},${paymentSql(paymentData.values.v_2026_10_07T03_00_00_000Z)}::timestamptz,${paymentSql(paymentData.values.v_2026_10_07T03_00_00_000Z)}::timestamptz,$4,${paymentSql(paymentData.values.storage_fingerprint)},$5::jsonb,${paymentSql(paymentData.values.sandbox_TEST)})`,
      [id, f.ids.tenancy, f.ids.creator, f.nextId(), JSON.stringify(sepaySnapshot)],
    );
    assert.equal(await f.finance.claimGatewayHandoff(id, 0, first), true);
    assert.equal(
      await f.finance.claimGatewayHandoff(id, 1, later),
      false,
      'B2 is unresolved; repository claim never authorizes resume',
    );
    const before = await f.finance.findGatewayCheckout(id);
    assert.ok(before);
    await client.query(
      `UPDATE gateway.gateway_checkouts SET handoff_attempt=2,updated_at=$1 WHERE checkout_id=$2 AND handoff_attempt=1`,
      [later, id],
    );
    const advanced = await f.finance.findGatewayCheckout(id);
    assert.deepEqual(advanced, { ...before, handoffAttempt: 2, updatedAt: later });
    assert.equal(advanced?.handoffClaimedAt, first);
    assert.equal(advanced?.firstDispatchAt, first);
    assert.equal(await f.finance.claimGatewayHandoff(id, 2, later), false);
    await client.query(
      `UPDATE gateway.gateway_checkouts SET replay_blocker=${paymentSql(paymentData.values.PROVIDER_RESUME_CONTRACT_REQUIRED)} WHERE checkout_id=$1`,
      [id],
    );
    assert.equal(await f.finance.claimGatewayHandoff(id, 2, later), false);
    await client.query(
      `UPDATE gateway.gateway_checkouts SET handoff_attempt=3 WHERE checkout_id=$1 AND handoff_attempt=2`,
      [id],
    );
    assert.equal(
      (await f.finance.findGatewayCheckout(id))?.handoffAttempt,
      paymentData.numbers.expectedCount3,
      'SQL does not decide unresolved resume policy',
    );
    for (const set of [
      'handoff_attempt=2',
      'handoff_attempt=5',
      "handoff_attempt=4,status='CREATED'",
      'handoff_attempt=4,handoff_claimed_at=now()',
      'handoff_attempt=4,first_dispatch_at=now()',
      paymentData.values.handoff_claimed_at_NULL,
      'first_dispatch_at=NULL',
    ]) {
      await assert.rejects(
        client.query(`UPDATE gateway.gateway_checkouts SET ${set} WHERE checkout_id=$1`, [id]),
        /immutable|handoff/,
      );
    }
    const paymentId = f.nextId();
    await f.finance.insertPayment({
      paymentId,
      tenancyId: f.ids.tenancy,
      amount: paymentData.values.v_1000_00,
      source: paymentData.values.GATEWAY,
      verification: paymentData.values.PROVIDER_VERIFIED,
      confirmedAt: first,
      voidedOrReversedAt: null,
      correctionNote: null,
      replacementPaymentId: null,
    });
    for (const status of [paymentData.values.FAILED, paymentData.values.SUCCEEDED]) {
      await client.query(
        `UPDATE gateway.gateway_checkouts SET status=$1,resulting_payment_id=$2 WHERE checkout_id=$3`,
        [status, status === paymentData.values.SUCCEEDED ? paymentId : null, id],
      );
      await assert.rejects(
        client.query(
          `UPDATE gateway.gateway_checkouts SET handoff_attempt=4,status=${paymentSql(paymentData.values.UNKNOWN)},resulting_payment_id=NULL WHERE checkout_id=$1`,
          [id],
        ),
        /Invalid gateway handoff attempt/,
      );
      assert.equal((await f.finance.findGatewayCheckout(id))?.status, status);
    }
  } finally {
    await client.end();
    await f.db.destroy();
  }
});

test('provider_snapshot_mismatch_is_rejected; local_invoice_collision_rejected_before_handoff; remote_id_scopes_and_roles_are_distinct; sepay_down_refuses_existing_rows', async () => {
  const url = process.env.TEST_DATABASE_URL;
  assert.ok(url);
  const f = await gatewayFixture(url, '000005_optional_sepay_gateway');
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const insert = async (
      provider: string,
      scope: string,
      invoice: string,
      snapshot: object,
      remote: string | null = null,
      trans: string | null = null,
    ) => {
      const id = f.nextId();
      await client.query(
        `INSERT INTO gateway.gateway_checkouts
        (checkout_id,tenancy_id,created_by_user_id,amount,reference_code,provider,provider_order_id,provider_request_id,status,created_at,updated_at,idempotency_key,fingerprint,request_snapshot,provider_partner_code,provider_trans_id${remote === null ? '' : ',provider_remote_order_id'})
        VALUES ($1,$2,$3,${paymentData.numbers.amountVnd},${paymentSql(paymentData.values.storage_test_2)},$4,$5,$6,${paymentSql(paymentData.values.CREATED)},${paymentSql(paymentData.values.v_2026_10_07T03_00_00_000Z)}::timestamptz,${paymentSql(paymentData.values.v_2026_10_07T03_00_00_000Z)}::timestamptz,$7,${paymentSql(paymentData.values.storage_fingerprint)},$8::jsonb,$9,$10${remote === null ? '' : ',$11'})`,
        [
          id,
          f.ids.tenancy,
          f.ids.creator,
          provider,
          invoice,
          f.nextId(),
          f.nextId(),
          JSON.stringify(snapshot),
          scope,
          trans,
          ...(remote === null ? [] : [remote]),
        ],
      );
      return id;
    };
    const momo = new HttpMomoPaymentClient({
      partnerCode: paymentData.values.TEST,
      accessKey: paymentData.values.test,
      secretKey: paymentData.values.test,
      endpoint: paymentData.values.https_test_payment_momo_vn,
      ipnUrl: paymentData.values.https_example_test_ipn,
      redirectUrl: paymentData.values.trooi_payment_momo,
    }).snapshot(paymentData.values.storage_test);
    await assert.rejects(
      insert(
        paymentData.values.MOMO,
        paymentData.values.TEST,
        paymentData.values.bad_momo,
        sepaySnapshot,
      ),
      /check constraint/,
    );
    await assert.rejects(
      insert(
        paymentData.values.SEPAY,
        paymentData.values.sandbox_TEST,
        paymentData.values.bad_sepay,
        momo,
      ),
      /check constraint/,
    );
    await assert.rejects(
      insert(
        paymentData.values.MOMO,
        paymentData.values.TEST,
        paymentData.values.bad_trans,
        momo,
        null,
        paymentData.values.opaque,
      ),
      /ck_gateway_checkout_trans/,
    );
    const momoId = await insert(
      paymentData.values.MOMO,
      paymentData.values.TEST,
      paymentData.values.same_local,
      momo,
      null,
      paymentData.values.v_42,
    );
    const readyId = await insert(
      paymentData.values.SEPAY,
      paymentData.values.sandbox_TEST,
      paymentData.values.ready_invoice,
      sepaySnapshot,
    );
    await client.query('DELETE FROM gateway.gateway_checkouts WHERE checkout_id=$1', [readyId]);
    await assert.rejects(
      insert(
        paymentData.values.SEPAY,
        paymentData.values.sandbox_TEST,
        paymentData.values.same_local,
        sepaySnapshot,
      ),
      /unique constraint/,
    );
    const sepayId = await insert(
      paymentData.values.SEPAY,
      paymentData.values.sandbox_TEST,
      paymentData.values.invoice_a,
      sepaySnapshot,
      paymentData.values.same_local,
      paymentData.values.opaque_transaction,
    );
    await assert.rejects(
      insert(
        paymentData.values.SEPAY,
        paymentData.values.sandbox_TEST,
        paymentData.values.invoice_b,
        sepaySnapshot,
        paymentData.values.same_local,
      ),
      /unique constraint/,
    );
    const otherId = await insert(
      paymentData.values.SEPAY,
      paymentData.values.sandbox_OTHER,
      paymentData.values.invoice_c,
      { ...sepaySnapshot, merchantId: paymentData.values.OTHER },
      paymentData.values.same_local,
      paymentData.values.opaque_transaction,
    );
    await assert.rejects(
      insert(
        paymentData.values.SEPAY,
        paymentData.values.sandbox_TEST,
        paymentData.values.invoice_d,
        sepaySnapshot,
        null,
        paymentData.values.opaque_transaction,
      ),
      /unique constraint/,
    );
    assert.equal(
      (
        await f.finance.findGatewayCheckoutByProviderInvoice(
          paymentData.values.MOMO,
          paymentData.values.TEST,
          paymentData.values.same_local,
        )
      )?.checkoutId,
      momoId,
    );
    assert.equal(
      await f.finance.findGatewayCheckoutByProviderInvoice(
        paymentData.values.SEPAY,
        paymentData.values.sandbox_TEST,
        paymentData.values.same_local,
      ),
      undefined,
    );
    assert.equal(
      (
        await f.finance.findGatewayCheckoutByRemoteOrderId(
          paymentData.values.SEPAY,
          paymentData.values.sandbox_TEST,
          paymentData.values.same_local,
        )
      )?.checkoutId,
      sepayId,
    );
    assert.equal(
      (
        await f.finance.findGatewayCheckoutByRemoteOrderId(
          paymentData.values.SEPAY,
          paymentData.values.sandbox_OTHER,
          paymentData.values.same_local,
        )
      )?.checkoutId,
      otherId,
    );
    assert.equal(
      await f.finance.findGatewayCheckoutByRemoteOrderId(
        paymentData.values.MOMO,
        paymentData.values.TEST,
        paymentData.values.same_local,
      ),
      undefined,
    );
    assert.equal(
      await f.finance.findGatewayCheckoutByRemoteOrderId(
        paymentData.values.SEPAY,
        paymentData.values.sandbox_TEST,
        paymentData.values.invoice_a,
      ),
      undefined,
    );
    for (const remote of [
      '',
      paymentData.values.empty,
      paymentData.values.x.repeat(paymentData.numbers.invalidLength),
    ]) {
      await assert.rejects(
        insert(
          paymentData.values.SEPAY,
          paymentData.values.sandbox_TEST,
          f.nextId(),
          sepaySnapshot,
          remote,
        ),
        /ck_gateway_checkout_remote/,
      );
    }
    for (const trans of [
      '',
      paymentData.values.empty,
      paymentData.values.x.repeat(paymentData.numbers.invalidLength),
    ]) {
      await assert.rejects(
        insert(
          paymentData.values.SEPAY,
          paymentData.values.sandbox_TEST,
          f.nextId(),
          sepaySnapshot,
          null,
          trans,
        ),
        /ck_gateway_checkout_trans/,
      );
    }
    const legacyId = f.nextId();
    await client.query(
      `INSERT INTO gateway.gateway_checkouts (checkout_id,tenancy_id,created_by_user_id,amount,reference_code,provider,provider_order_id,provider_request_id,status,replay_blocker,created_at,updated_at)
      VALUES ($1,$2,$3,${paymentData.numbers.amountVnd},${paymentSql(paymentData.values.legacy)},${paymentSql(paymentData.values.MOMO)},${paymentSql(paymentData.values.unscoped_legacy)},${paymentSql(paymentData.values.unscoped_request)},${paymentSql(paymentData.values.CREATED)},${paymentSql(paymentData.values.LEGACY_RECONCILIATION_REQUIRED)},${paymentSql(paymentData.values.v_2026_10_07T03_00_00_000Z)}::timestamptz,${paymentSql(paymentData.values.v_2026_10_07T03_00_00_000Z)}::timestamptz)`,
      [legacyId, f.ids.tenancy, f.ids.creator],
    );
    await assert.rejects(
      client.query(
        `UPDATE gateway.gateway_checkouts SET provider_remote_order_id=$1 WHERE checkout_id=$2`,
        [paymentData.values.unscoped, legacyId],
      ),
      /ck_gateway_checkout_remote/,
    );
    const now = paymentData.values.v_2026_10_07T01_00_00_000Z;
    const claims = await Promise.all(
      Array.from({ length: paymentData.numbers.scenarioCount8 }, () =>
        f.finance.claimGatewayHandoff(sepayId, 0, now),
      ),
    );
    assert.equal(claims.filter(Boolean).length, paymentData.numbers.expectedCount1);
    assert.equal(await f.finance.claimGatewayHandoff(sepayId, 0, now), false);
    assert.equal(
      await f.finance.claimGatewayHandoff(sepayId, 1, now),
      false,
      'claim alone never authorizes resume',
    );
    assert.equal(await f.finance.claimGatewayHandoff(momoId, 0, now), false);
    const claimed = await f.finance.findGatewayCheckout(sepayId);
    assert.equal(claimed?.handoffAttempt, paymentData.numbers.expectedCount1);
    assert.equal(claimed?.handoffClaimedAt, now);
    assert.equal(claimed?.firstDispatchAt, now);
    assert.equal(claimed?.status, paymentData.values.UNKNOWN);
    await assert.rejects(
      client.query(
        `UPDATE gateway.gateway_checkouts SET handoff_claimed_at=${paymentSql(paymentData.values.v_2026_10_07T03_00_00_000Z)}::timestamptz WHERE checkout_id=$1`,
        [otherId],
      ),
      /requires an attempt/,
    );
    assert.equal(
      await f.finance.acquireGatewayDispatchLease(
        sepayId,
        f.nextId(),
        now,
        paymentData.values.v_2026_10_07T01_01_00_000Z,
      ),
      false,
    );
    for (const set of [
      'handoff_attempt=0',
      'handoff_attempt=3',
      paymentData.values.handoff_claimed_at_NULL,
      'first_dispatch_at=NULL',
      "provider_remote_order_id='changed'",
      "provider_order_id='changed'",
      "fingerprint='changed'",
    ]) {
      await assert.rejects(
        client.query(`UPDATE gateway.gateway_checkouts SET ${set} WHERE checkout_id=$1`, [sepayId]),
        /immutable|handoff/,
      );
    }
    await client.query(
      `UPDATE gateway.gateway_checkouts SET provider_outcome_stage=${paymentSql(paymentData.values.RECONCILIATION)} WHERE checkout_id=$1`,
      [sepayId],
    );
    await assert.rejects(
      client.query(
        `UPDATE gateway.gateway_checkouts SET provider_result_code=0 WHERE checkout_id=$1`,
        [sepayId],
      ),
      /check constraint/,
    );
    await assert.rejects(
      client.query(
        `UPDATE gateway.gateway_checkouts SET status=${paymentSql(paymentData.values.SUCCEEDED)} WHERE checkout_id=$1`,
        [sepayId],
      ),
      /ck_gateway_checkout_result/,
    );
    await paymentMigrationPrefix(url, '000005_optional_sepay_gateway');
    assert.equal(
      (await client.query('SELECT name FROM schema_migrations ORDER BY id DESC LIMIT 1')).rows[0]
        ?.name,
      '000005_optional_sepay_gateway',
    );
    await assert.rejects(
      paymentMigrationPrefix(url, '000004_gateway_checkout_durability'),
      /SEPAY/,
    );
    assert.equal(
      (
        await client.query(
          "SELECT count(*)::int AS n FROM gateway.gateway_checkouts WHERE provider='SEPAY'",
        )
      ).rows[0].n,
      paymentData.numbers.expectedCount2,
    );
    assert.equal((await queryCatalog(url)).tables.length, paymentData.numbers.frozenV1TableCount);
    await client.query("DELETE FROM gateway.gateway_checkouts WHERE provider='SEPAY'");
    await paymentMigrationPrefix(url, '000004_gateway_checkout_durability');
    await paymentMigrationPrefix(url, '000005_optional_sepay_gateway');
    assert.equal(
      (await f.finance.findGatewayCheckout(momoId))?.providerTransId,
      paymentData.values.v_42,
    );
  } finally {
    await client.end();
    await f.db.destroy();
  }
});

test('disposable reset rejects other database names before connecting', async () => {
  for (const name of [
    paymentData.values.trooi_dev,
    paymentData.values.postgres,
    paymentData.values.trooi_test_extra,
    '',
  ]) {
    await assert.rejects(
      resetPublicSchema(`postgresql://localhost:1/${name}`),
      /Only a local trooi_test database may be reset/,
    );
  }
});

test('initial migration matches the frozen physical catalog', async () => {
  const databaseUrl = process.env.TEST_DATABASE_URL;
  assert.ok(databaseUrl, 'TEST_DATABASE_URL is required for migration parity');

  await resetPublicSchema(databaseUrl);
  await paymentMigrationPrefix(databaseUrl, '000003_gateway_checkouts');

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const extension = await client.query<{ installed: boolean }>(
      "SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') AS installed",
    );
    assert.equal(extension.rows[0]?.installed, true);
    await client.query('CREATE TABLE gateway.reset_residue (id integer);');
    await resetPublicSchema(databaseUrl);
    await paymentMigrationPrefix(databaseUrl, '000003_gateway_checkouts');
    const residue = await client.query<{ absent: boolean }>(
      "SELECT to_regclass('gateway.reset_residue') IS NULL AS absent",
    );
    assert.equal(residue.rows[0]?.absent, true);
    const foreignKeys = await client.query<{ count: number }>(
      "SELECT count(*)::integer AS count FROM pg_constraint WHERE conrelid = 'gateway.gateway_checkouts'::regclass AND contype = 'f' AND confrelid IN ('public.tenancies'::regclass, 'public.payments'::regclass)",
    );
    assert.equal(foreignKeys.rows[0]?.count, paymentData.numbers.expectedCount2);
  } finally {
    await client.end();
  }

  await resetPublicSchema(databaseUrl);
  await paymentMigrationPrefix(databaseUrl, '000001_initial_schema');
  const catalog = await queryCatalog(databaseUrl);
  assert.equal(catalog.tables.length, paymentData.numbers.frozenV1TableCount);

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
    assert.equal(
      verification.status,
      paymentData.numbers.expectedCount0,
      `${verification.stdout}${verification.stderr}`,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('gateway fixture supplies an active tenancy, authorized creator and recipient', async () => {
  const databaseUrl = process.env.TEST_DATABASE_URL;
  assert.ok(databaseUrl, 'TEST_DATABASE_URL is required for gateway fixture');
  const f = await gatewayFixture(databaseUrl, '000007_sepay_production');
  try {
    assert.equal((await f.tenancies.findTenancy(f.ids.tenancy))?.status, paymentData.values.ACTIVE);
    assert.equal((await f.tenancies.findActivePrimary(f.ids.tenancy))?.userId, f.ids.recipient);
    assert.equal(await f.identity.userExists(f.ids.creator), paymentData.states.userExists);
    await f.manager.run(async ({ repositories }) => {
      assert.equal(
        (await repositories.organization?.findOrganization(f.ids.org))?.primaryOwnerUserId,
        f.ids.creator,
      );
      assert.equal(
        (await repositories.finance.findCharge(f.ids.charge))?.amount,
        paymentData.values.v_1000_00,
      );
      assert.equal(
        (await repositories.finance.findPaymentsForTenancy(f.ids.tenancy)).length,
        paymentData.numbers.expectedCount0,
      );
    });
    assert.deepEqual(await f.notifications.findNotificationsByRecipient(f.ids.recipient), []);
  } finally {
    await f.db.destroy();
  }
});

test('durability migration preserves legacy IDs/results and blocks unreconstructible replay', async () => {
  const url = process.env.TEST_DATABASE_URL;
  assert.ok(url);
  const f = await gatewayFixture(url, '000005_optional_sepay_gateway');
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await paymentMigrationPrefix(url, '000003_gateway_checkouts');
    const catalog = await client.query('SELECT name FROM schema_migrations ORDER BY id');
    assert.deepEqual(
      catalog.rows.map((row) => row.name),
      ['000001_initial_schema', '000002_prepare_initial_rollback', '000003_gateway_checkouts'],
    );
    const paymentId = paymentData.values.v_92000000_0000_4000_8000_000000000001;
    await f.finance.insertPayment({
      paymentId,
      tenancyId: f.ids.tenancy,
      amount: paymentData.values.v_1000_00,
      source: paymentData.values.GATEWAY,
      verification: paymentData.values.PROVIDER_VERIFIED,
      confirmedAt: paymentData.values.v_2026_10_05T00_00_00_000Z,
      voidedOrReversedAt: null,
      correctionNote: null,
      replacementPaymentId: null,
    });
    const ids = [
      paymentData.values.v_93000000_0000_4000_8000_000000000001,
      paymentData.values.v_93000000_0000_4000_8000_000000000002,
    ];
    for (let i = 0; i < ids.length; i++) {
      await client.query(
        `INSERT INTO gateway.gateway_checkouts
        (checkout_id,tenancy_id,created_by_user_id,amount,reference_code,provider,provider_order_id,provider_request_id,status,resulting_payment_id,created_at,updated_at)
        VALUES ($1,$2,$3,${paymentData.numbers.amountVnd},${paymentSql(paymentData.values.legacy)},${paymentSql(paymentData.values.MOMO)},$4,$5,$6,$7,${paymentSql(paymentData.values.v_2026_10_07T03_00_00_000Z)}::timestamptz,${paymentSql(paymentData.values.v_2026_10_07T03_00_00_000Z)}::timestamptz)`,
        [
          ids[i],
          f.ids.tenancy,
          f.ids.creator,
          `legacy-order-${i}`,
          `legacy-request-${i}`,
          i ? paymentData.values.SUCCEEDED : paymentData.values.CREATED,
          i ? paymentId : null,
        ],
      );
    }
    await paymentMigrationPrefix(url, '000004_gateway_checkout_durability');
    const rows = (
      await client.query('SELECT * FROM gateway.gateway_checkouts ORDER BY checkout_id')
    ).rows;
    assert.equal(rows[0].checkout_id, ids[0]);
    assert.equal(rows[0].provider_order_id, paymentData.values.legacy_order_0);
    assert.equal(rows[0].provider_request_id, paymentData.values.legacy_request_0);
    assert.equal(rows[0].status, paymentData.values.CREATED);
    assert.equal(rows[0].replay_blocker, paymentData.values.LEGACY_RECONCILIATION_REQUIRED);
    assert.equal(rows[0].request_snapshot, null);
    assert.equal(rows[0].provider_partner_code, null);
    assert.equal(rows[1].status, paymentData.values.SUCCEEDED);
    assert.equal(rows[1].resulting_payment_id, paymentId);
    await paymentMigrationPrefix(url, '000004_gateway_checkout_durability');
    assert.equal(
      (await client.query('SELECT count(*)::int AS count FROM gateway.gateway_checkouts')).rows[0]
        .count,
      paymentData.numbers.expectedCount2,
    );
    await paymentMigrationPrefix(url, '000003_gateway_checkouts');
    await paymentMigrationPrefix(url, '000004_gateway_checkout_durability');
    assert.equal(
      (await client.query('SELECT name FROM schema_migrations ORDER BY id DESC LIMIT 1')).rows[0]
        ?.name,
      '000004_gateway_checkout_durability',
    );
    await paymentMigrationPrefix(url, '000004_gateway_checkout_durability');
    // The current repository includes columns introduced by 000005; migration 000004 assertions above use its own SQL shape.
    await paymentMigrationPrefix(url, '000005_optional_sepay_gateway');
    assert.equal((await f.finance.findGatewayCheckout(ids[1]!))?.resultingPaymentId, paymentId);
  } finally {
    await client.end();
    await f.db.destroy();
  }
});

test('PostgreSQL dispatch sees committed intent and lease, releases locks, and elects one same-key caller', async () => {
  const url = process.env.TEST_DATABASE_URL;
  assert.ok(url);
  const f = await gatewayFixture(url, '000005_optional_sepay_gateway');
  const client = new Client({ connectionString: url });
  await client.connect();
  const protocol = new HttpMomoPaymentClient({
    partnerCode: paymentData.values.TEST,
    accessKey: paymentData.values.test,
    secretKey: paymentData.values.test,
    endpoint: paymentData.values.https_test_payment_momo_vn,
    ipnUrl: paymentData.values.https_example_test_ipn,
    redirectUrl: paymentData.values.trooi_payment_momo,
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
  const gateway = new PaymentGatewayService(
    new TenancyService(f.manager),
    f.manager,
    new GatewayProviderRegistry(
      new MomoGatewayAdapter({
        snapshot: (id) => protocol.snapshot(id),
        verifyIpn: () => paymentData.states.providerSignatureAccepted,
        async createCaptureWallet(input) {
          calls++;
          if (calls > 1)
            return {
              resultCode: paymentData.numbers.ipnResultCode,
              message: paymentData.values.ok,
              payUrl: paymentData.values.https_test_payment_momo_vn_pay,
              deeplink: paymentData.states.absent,
            };
          const stored = (
            await client.query(
              'SELECT * FROM gateway.gateway_checkouts WHERE provider_order_id=$1',
              [input.orderId],
            )
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
            resultCode: paymentData.numbers.ipnResultCode,
            message: paymentData.values.ok,
            payUrl: paymentData.values.https_test_payment_momo_vn_pay,
            deeplink: paymentData.states.absent,
          };
        },
      }),
    ),
    new GatewaySettlementService(
      f.manager,
      () => new Date(paymentData.values.v_2026_10_05T00_00_00_000Z),
    ),
    undefined,
    () => new Date(paymentData.values.v_2026_10_05T00_00_00_000Z),
  );
  try {
    const key = f.nextId();
    const first = gateway.createCheckout(
      { tenancyId: f.ids.tenancy, amount: paymentData.values.v_1000 },
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
      ...Array.from({ length: paymentData.numbers.scenarioCount7 }, () =>
        gateway.createCheckout(
          { tenancyId: f.ids.tenancy, amount: paymentData.values.v_1000 },
          f.ids.creator,
          key,
        ),
      ),
    ];
    release();
    const results = await Promise.all(attempts);
    assert.equal(new Set(results.map((r) => r.id)).size, paymentData.numbers.expectedCount1);
    assert.equal(calls, paymentData.numbers.expectedCount1);
    const racingKey = f.nextId();
    const racing = await Promise.all(
      Array.from({ length: paymentData.numbers.scenarioCount8 }, () =>
        gateway.createCheckout(
          { tenancyId: f.ids.tenancy, amount: paymentData.values.v_1000 },
          f.ids.creator,
          racingKey,
        ),
      ),
    );
    assert.equal(new Set(racing.map((r) => r.id)).size, paymentData.numbers.expectedCount1);
    assert.equal(
      calls,
      paymentData.numbers.expectedCount2,
      'simultaneous new intent race elects exactly one additional dispatcher',
    );
    assert.equal(
      (await f.finance.findPaymentsForTenancy(f.ids.tenancy)).length,
      paymentData.numbers.expectedCount0,
    );
    const id = results[0]!.id;
    await assert.rejects(
      client.query(
        `UPDATE gateway.gateway_checkouts SET provider_request_id=$1 WHERE checkout_id=$2`,
        [paymentData.values.changed, id],
      ),
      /immutable/,
    );
    await assert.rejects(
      client.query(
        `UPDATE gateway.gateway_checkouts SET status=${paymentSql(paymentData.values.SUCCEEDED)} WHERE checkout_id=$1`,
        [id],
      ),
      /ck_gateway_checkout_result/,
    );
    const record = await f.finance.findGatewayCheckout(id);
    assert.ok(record);
    await assert.rejects(
      f.finance.insertGatewayCheckout({
        ...record,
        checkoutId: f.nextId(),
        idempotencyKey: f.nextId(),
        providerOrderId: f.nextId(),
      }),
      /unique constraint/,
    );
    await assert.rejects(
      f.finance.insertGatewayCheckout({
        ...record,
        checkoutId: f.nextId(),
        idempotencyKey: f.nextId(),
        providerOrderId: f.nextId(),
        providerRequestId: f.nextId(),
        amount: paymentData.values.v_1000_50,
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
  const f = await gatewayFixture(url, '000005_optional_sepay_gateway');
  let now = new Date(paymentData.values.v_2026_10_05T00_00_00_000Z);
  let failure: `INSERT` | 'AFTER_LEASE' | null = paymentData.values.INSERT;
  const manager: TransactionManager = {
    async run(work) {
      let acquired = false;
      const result = await f.manager.run(async (context) => {
        const finance = context.repositories.finance;
        const insert = finance.insertGatewayCheckout.bind(finance);
        finance.insertGatewayCheckout = async (record) => {
          await insert(record);
          if (failure === paymentData.values.INSERT) throw new Error('intent commit failure');
        };
        const lease = finance.acquireGatewayDispatchLease.bind(finance);
        finance.acquireGatewayDispatchLease = async (...args) => {
          acquired = await lease(...args);
          return acquired;
        };
        return work(context);
      });
      if (acquired && failure === paymentData.values.AFTER_LEASE)
        throw new Error('process stopped after committed lease');
      return result;
    },
  };
  const protocol = new HttpMomoPaymentClient({
    partnerCode: paymentData.values.TEST,
    accessKey: paymentData.values.test,
    secretKey: paymentData.values.test,
    endpoint: paymentData.values.https_test_payment_momo_vn,
    ipnUrl: paymentData.values.https_example_test_ipn,
    redirectUrl: paymentData.values.trooi_payment_momo,
  });
  let calls = 0;
  const gateway = new PaymentGatewayService(
    new TenancyService(manager),
    manager,
    new GatewayProviderRegistry(
      new MomoGatewayAdapter({
        snapshot: (id) => protocol.snapshot(id),
        verifyIpn: () => paymentData.states.providerSignatureAccepted,
        async createCaptureWallet() {
          calls++;
          return {
            resultCode: paymentData.numbers.ipnResultCode,
            message: paymentData.values.ok,
            payUrl: paymentData.values.https_test_payment_momo_vn_pay,
            deeplink: paymentData.states.absent,
          };
        },
      }),
    ),
    new GatewaySettlementService(manager, () => now),
    undefined,
    () => now,
  );
  const input = { tenancyId: f.ids.tenancy, amount: paymentData.values.v_1000 };
  const key = f.nextId();
  try {
    await assert.rejects(
      gateway.createCheckout(input, f.ids.creator, key),
      /intent commit failure/,
    );
    assert.equal(await f.finance.findGatewayCheckoutByClientKey(f.ids.creator, key), undefined);
    assert.equal(calls, paymentData.numbers.expectedCount0);
    failure = paymentData.values.AFTER_LEASE;
    await assert.rejects(gateway.createCheckout(input, f.ids.creator, key), /process stopped/);
    const crashed = await f.finance.findGatewayCheckoutByClientKey(f.ids.creator, key);
    assert.ok(crashed?.dispatchLeaseOwner);
    assert.equal(calls, paymentData.numbers.expectedCount0);
    failure = null;
    const waiting = await gateway.createCheckout(input, f.ids.creator, key);
    assert.equal(waiting.replayBlockedReason, paymentData.values.DISPATCH_IN_PROGRESS);
    assert.equal(calls, paymentData.numbers.expectedCount0);
    now = new Date(now.getTime() + paymentData.numbers.leaseRecoveryMs);
    const recovered = await gateway.createCheckout(input, f.ids.creator, key);
    assert.equal(recovered.id, crashed.checkoutId);
    assert.equal(recovered.status, paymentData.values.CREATED);
    assert.equal(calls, paymentData.numbers.expectedCount1);
    assert.equal(
      (await f.finance.findGatewayCheckout(recovered.id))?.providerRequestId,
      crashed.providerRequestId,
    );
    assert.equal(
      (await f.finance.findPaymentsForTenancy(f.ids.tenancy)).length,
      paymentData.numbers.expectedCount0,
    );
  } finally {
    await f.db.destroy();
  }
});

test('gateway durability constraints remain at SQL level and public catalog stays 29', async () => {
  const url = process.env.TEST_DATABASE_URL;
  assert.ok(url);
  const f = await gatewayFixture(url, '000005_optional_sepay_gateway');
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
        'uq_gateway_checkout_remote_order',
        'uq_gateway_checkouts_provider_order',
        'uq_gateway_checkouts_resulting_payment',
      ],
    );
    const fks = await client.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM pg_constraint
       WHERE conrelid = 'gateway.gateway_checkouts'::regclass AND contype = 'f'`,
    );
    assert.equal(fks.rows[0]?.count, paymentData.numbers.expectedCount2);
    const checks = await client.query<{ conname: string }>(
      `SELECT conname FROM pg_constraint
       WHERE conrelid = 'gateway.gateway_checkouts'::regclass AND contype = 'c'
         AND conname IN (
           'ck_gateway_checkout_result','ck_gateway_checkout_trans','ck_gateway_checkouts_status'
         )
       ORDER BY conname`,
    );
    assert.equal(checks.rows.length, paymentData.numbers.expectedCount3);
    const catalog = await queryCatalog(url);
    assert.equal(catalog.tables.length, paymentData.numbers.frozenV1TableCount);
  } finally {
    await client.end();
    await f.db.destroy();
  }
});

test('full chain adds exactly frozen Identity tables and preserves financial ownership records', async () => {
  const url = process.env.TEST_DATABASE_URL;
  assert.ok(url);
  const f = await gatewayFixture(url, '000007_sepay_production');
  const client = new Client({ connectionString: url });
  await client.connect();
  const snapshot = async () => {
    const rows: Record<string, unknown[]> = {};
    for (const table of [
      'users',
      'organizations',
      'tenancies',
      'tenancy_terms',
      'billing_cycles',
      'charges',
      'payments',
      'gateway.gateway_checkouts',
    ])
      rows[table] = (
        await client.query(
          `SELECT to_jsonb(t) AS record FROM ${table} t ORDER BY to_jsonb(t)::text`,
        )
      ).rows;
    return rows;
  };
  try {
    await f.finance.insertPayment({
      paymentId: f.nextId(),
      tenancyId: f.ids.tenancy,
      amount: f.amount,
      source: paymentData.values.GATEWAY,
      verification: paymentData.values.PROVIDER_VERIFIED,
      confirmedAt: paymentData.values.v_2026_10_07T00_00_00_000Z,
      voidedOrReversedAt: paymentData.states.absent,
      correctionNote: paymentData.states.absent,
      replacementPaymentId: paymentData.states.absent,
    });
    const before = await snapshot();
    await paymentMigrationPrefix(url, '000008_identity_foundation');
    assert.deepEqual(await snapshot(), before);
    const catalog = await queryCatalog(url);
    const tables = (path: string) =>
      (JSON.parse(readFileSync(path, 'utf8')) as { tables: { name: string }[] }).tables.map(
        (table) => table.name,
      );
    assert.deepEqual(
      catalog.tables.slice().sort(),
      [
        ...tables('docs/database/v1/erd/physical.json'),
        ...tables('docs/database/vnext/identity-foundation/physical.json'),
      ].sort(),
    );
  } finally {
    await client.end();
    await f.db.destroy();
  }
});
