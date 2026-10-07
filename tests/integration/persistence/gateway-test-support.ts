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
import { rentalFixture } from './guards/rental-test-support';

export const TEST_MOMO = {
  partnerCode: 'TEST',
  accessKey: 'test',
  secretKey: 'test',
  endpoint: 'https://test-payment.momo.vn',
  ipnUrl: 'https://example.test/ipn',
  redirectUrl: 'trooi://payment/momo',
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
  if (record.provider !== 'MOMO') throw new Error('MoMo IPN fixture requires MOMO');
  const payload: MomoIpnPayload = {
    partnerCode: record.providerPartnerCode ?? TEST_MOMO.partnerCode,
    orderId: record.providerOrderId,
    requestId: record.providerRequestId,
    amount: Number(record.amount.split('.')[0]),
    orderInfo: record.referenceCode,
    orderType: 'momo_wallet',
    transId: 1,
    resultCode: 0,
    message: 'Successful.',
    payType: 'qr',
    responseTime: 1,
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
    for (let n = 0; n < 400; n++) {
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
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    throw new Error('expected overlapping PostgreSQL lock wait on gateway.gateway_checkouts');
  } finally {
    await client.end();
  }
}

export async function gatewayFixture(url: string) {
  const f = await rentalFixture(url);
  try {
    const ids = {
      ...f.ids,
      creator: f.ids.user,
      recipient: '10000000-0000-4000-8000-000000000002',
      participant: '82000000-0000-4000-8000-000000000001',
      terms: '83000000-0000-4000-8000-000000000001',
      cycle: '90000000-0000-4000-8000-000000000001',
      charge: '91000000-0000-4000-8000-000000000001',
    };
    const amount = '1000.00';
    const identity = new PostgresIdentityRepository(f.db);
    const finance = new PostgresFinanceRepository(f.db);
    const notifications = new PostgresNotificationRepository(f.db);
    await identity.ensureUser(ids.recipient);
    await f.tenancies.createTenancy({
      tenancyId: ids.tenancy, roomId: ids.room, status: 'ACTIVE',
      startedAt: '2026-01-01T00:00:00.000Z', endedAt: null, endReason: null,
    });
    await f.tenancies.insertParticipant({
      tenancyParticipantId: ids.participant, tenancyId: ids.tenancy,
      userId: ids.recipient, role: 'PRIMARY',
      joinedAt: '2026-01-01T00:00:00.000Z', leftAt: null,
    });
    await f.tenancies.insertTerms({
      tenancyTermsId: ids.terms, tenancyId: ids.tenancy, version: 1,
      rentAmount: amount, agreedDepositRequirement: amount,
      termStart: '2026-01-01', termEnd: '2026-12-31',
      billingDayOrDueDateRule: {}, electricityArrangement: {}, waterArrangement: {},
      minimalRentalConditions: {}, effectiveFromCycleBoundary: '2026-01-01',
    });
    await finance.insertBillingCycle({
      billingCycleId: ids.cycle, tenancyId: ids.tenancy, tenancyTermsId: ids.terms,
      periodStart: '2026-01-01', periodEnd: '2026-01-31',
    });
    await finance.insertCharge({
      chargeId: ids.charge, billingCycleId: ids.cycle, chargeType: 'RENT', amount,
      utilityConnectionId: null, startMeterReadingId: null, endMeterReadingId: null,
    });
    return { ...f, ids, amount, identity, finance, notifications };
  } catch (error) {
    await f.db.destroy();
    throw error;
  }
}
