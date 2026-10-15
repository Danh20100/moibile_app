import { paymentData, createPaymentFixtureIds } from '../../support/payment-fixtures';
import { Client } from 'pg';

import { createDatabaseClient } from '../../../src/infrastructure/database/database.client';
import { PostgresTransactionManager } from '../../../src/infrastructure/database/postgres-transaction-manager';
import { PostgresFinanceRepository } from '../../../src/infrastructure/database/repositories/finance.repository';
import { PostgresIdentityRepository } from '../../../src/infrastructure/database/repositories/identity.repository';
import { PostgresNotificationRepository } from '../../../src/infrastructure/database/repositories/notification.repository';
import { createRepositorySet } from '../../../src/infrastructure/database/repositories/repository-set';
import { momoIpnRaw, signMomoRaw } from '../../../src/modules/payment-gateway/momo/momo-hmac';
import type { MomoIpnPayload } from '../../../src/modules/payment-gateway/momo/momo-client';
import type { GatewayCheckoutRecord } from '../../../src/persistence/ports/finance.repository';
import { resetPublicSchema } from './support/postgres-test-harness';
import { paymentMigrationPrefix } from './support/payment-migration-prefix';
import { rentalFixture } from './guards/rental-test-support';

export const TEST_MOMO = {
  partnerCode: paymentData.values.TEST,
  accessKey: paymentData.values.test,
  secretKey: paymentData.values.test,
  endpoint: paymentData.values.https_test_payment_momo_vn,
  ipnUrl: paymentData.values.https_example_test_ipn,
  redirectUrl: paymentData.values.trooi_payment_momo,
};

export function createBarrier() {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { gate, release };
}

export function createLatch() {
  let signal!: () => void;
  const ready = new Promise<void>((resolve) => {
    signal = resolve;
  });
  return { ready, signal };
}

export function openGatewayPool(url: string) {
  const db = createDatabaseClient({ url, maxPoolSize: 4, connectionTimeoutMs: 5000 });
  return {
    db,
    manager: new PostgresTransactionManager(db, createRepositorySet),
    finance: new PostgresFinanceRepository(db),
    notifications: new PostgresNotificationRepository(db),
    close: () => db.destroy(),
  };
}

export function signedCheckoutIpn(
  record: GatewayCheckoutRecord,
  overrides: Partial<MomoIpnPayload> = {},
): MomoIpnPayload {
  if (record.provider !== paymentData.values.MOMO)
    throw new Error('MoMo IPN fixture requires MOMO');
  const payload: MomoIpnPayload = {
    partnerCode: record.providerPartnerCode ?? TEST_MOMO.partnerCode,
    orderId: record.providerOrderId,
    requestId: record.providerRequestId,
    amount: Number(record.amount.split(paymentData.values.empty_2)[0]),
    orderInfo: record.referenceCode,
    orderType: paymentData.values.momo_wallet,
    transId: paymentData.numbers.ipnTransactionId,
    resultCode: paymentData.numbers.ipnResultCode,
    message: paymentData.values.Successful,
    payType: paymentData.values.qr,
    responseTime: paymentData.numbers.ipnResponseTime,
    extraData: record.requestSnapshot?.extraData ?? '',
    signature: '',
    ...overrides,
  };
  payload.signature = signMomoRaw(
    momoIpnRaw({
      accessKey: TEST_MOMO.accessKey,
      amount: String(payload.amount),
      extraData: payload.extraData ?? '',
      message: payload.message ?? '',
      orderId: payload.orderId,
      orderInfo: payload.orderInfo ?? '',
      orderType: payload.orderType ?? '',
      partnerCode: payload.partnerCode ?? TEST_MOMO.partnerCode,
      payType: payload.payType ?? '',
      requestId: payload.requestId,
      responseTime: String(payload.responseTime ?? ''),
      resultCode: String(payload.resultCode ?? ''),
      transId: String(payload.transId ?? ''),
    }),
    TEST_MOMO.secretKey,
  );
  return payload;
}

export async function assertCheckoutRowLockWaiter(url: string): Promise<void> {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const deadline = performance.now() + paymentData.numbers.lockObservationTimeoutMs;
    while (performance.now() < deadline) {
      const waiting = await client.query<{ waiting: boolean }>(`
        SELECT EXISTS (
          SELECT 1
          FROM pg_locks blocked
          JOIN pg_class rel ON rel.oid = blocked.relation
          JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
          WHERE NOT blocked.granted
            AND nsp.nspname = 'gateway'
            AND rel.relname = 'gateway_checkouts'
        ) AS waiting`);
      if (waiting.rows[0]?.waiting) return;
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
    throw new Error('expected overlapping PostgreSQL lock wait on gateway.gateway_checkouts');
  } finally {
    await client.end();
  }
}

export async function gatewayFixture(url: string, migrationPrefix?: string) {
  const f = await rentalFixture(
    url,
    migrationPrefix
      ? {
          initializeDatabase: async (databaseUrl) => {
            await resetPublicSchema(databaseUrl);
            await paymentMigrationPrefix(databaseUrl, migrationPrefix);
          },
        }
      : undefined,
  );
  try {
    const ids = {
      ...f.ids,
      creator: f.ids.user,
      recipient: paymentData.values.v_10000000_0000_4000_8000_000000000002,
      participant: paymentData.values.v_82000000_0000_4000_8000_000000000001,
      terms: paymentData.values.v_83000000_0000_4000_8000_000000000001,
      cycle: paymentData.values.v_90000000_0000_4000_8000_000000000001,
      charge: paymentData.values.v_91000000_0000_4000_8000_000000000001,
    };
    const amount = paymentData.values.v_1000_00;
    const identity = new PostgresIdentityRepository(f.db);
    const finance = new PostgresFinanceRepository(f.db);
    const notifications = new PostgresNotificationRepository(f.db);
    await identity.ensureUser(ids.recipient);
    await f.tenancies.createTenancy({
      tenancyId: ids.tenancy,
      roomId: ids.room,
      status: paymentData.values.ACTIVE,
      startedAt: paymentData.values.v_2026_01_01T00_00_00_000Z,
      endedAt: paymentData.states.absent,
      endReason: paymentData.states.absent,
    });
    await f.tenancies.insertParticipant({
      tenancyParticipantId: ids.participant,
      tenancyId: ids.tenancy,
      userId: ids.recipient,
      role: paymentData.values.PRIMARY,
      joinedAt: paymentData.values.v_2026_01_01T00_00_00_000Z,
      leftAt: paymentData.states.absent,
    });
    await f.tenancies.insertTerms({
      tenancyTermsId: ids.terms,
      tenancyId: ids.tenancy,
      version: paymentData.numbers.scenarioCount1,
      rentAmount: amount,
      agreedDepositRequirement: amount,
      termStart: paymentData.values.v_2026_01_01,
      termEnd: paymentData.values.v_2026_12_31,
      billingDayOrDueDateRule: paymentData.states.emptyPayload,
      electricityArrangement: paymentData.states.emptyPayload,
      waterArrangement: paymentData.states.emptyPayload,
      minimalRentalConditions: paymentData.states.emptyPayload,
      effectiveFromCycleBoundary: paymentData.values.v_2026_01_01,
    });
    await finance.insertBillingCycle({
      billingCycleId: ids.cycle,
      tenancyId: ids.tenancy,
      tenancyTermsId: ids.terms,
      periodStart: paymentData.values.v_2026_01_01,
      periodEnd: paymentData.values.v_2026_01_31,
    });
    await finance.insertCharge({
      chargeId: ids.charge,
      billingCycleId: ids.cycle,
      chargeType: paymentData.values.RENT,
      amount,
      utilityConnectionId: null,
      startMeterReadingId: null,
      endMeterReadingId: null,
    });
    return {
      ...f,
      ids,
      amount,
      identity,
      finance,
      notifications,
      nextId: createPaymentFixtureIds(),
    };
  } catch (error) {
    await f.db.destroy();
    throw error;
  }
}
