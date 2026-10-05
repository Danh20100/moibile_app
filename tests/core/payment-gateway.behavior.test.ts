import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import { BillingService } from '../../src/modules/billing/services/billing.service';
import type {
  MomoCreatePaymentInput,
  MomoCreatePaymentResult,
  MomoIpnPayload,
  MomoPaymentClient,
} from '../../src/modules/payment-gateway/momo/momo-client';
import {
  HttpMomoPaymentClient,
  MomoVerificationError,
} from '../../src/modules/payment-gateway/momo/momo-client';
import { momoIpnRaw, signMomoRaw } from '../../src/modules/payment-gateway/momo/momo-hmac';
import { PaymentGatewayService } from '../../src/modules/payment-gateway/services/payment-gateway.service';
import { TenancyService } from '../../src/modules/tenancy/services/tenancy.service';
import { createCoreTestTransactionManager } from './support/in-memory-transaction-manager';

const operatorUserId = '10000000-0000-4000-8000-000000000001';
const tenantUserId = '10000000-0000-4000-8000-000000000002';
const orgId = '20000000-0000-4000-8000-000000000011';
const propertyId = '30000000-0000-4000-8000-000000000011';
const roomId = '40000000-0000-4000-8000-000000000011';
const tenancyId = '60000000-0000-4000-8000-000000000011';
const participantId = '70000000-0000-4000-8000-000000000011';
const termsId = 'terms-momo';

const TEST_MOMO = {
  partnerCode: 'TEST',
  accessKey: 'access',
  secretKey: 'secret-key-for-tests',
  endpoint: 'https://test-payment.momo.vn',
  ipnUrl: 'https://example.test/api/v1/finance/checkouts/momo/ipn',
  redirectUrl: 'trooi://payment/momo',
};

class FakeMomo implements MomoPaymentClient {
  readonly verifier = new HttpMomoPaymentClient(TEST_MOMO);
  snapshot(id: string) {
    return this.verifier.snapshot(id);
  }
  createCalls = 0;
  requests: MomoCreatePaymentInput[] = [];
  dispatch?: (input: MomoCreatePaymentInput) => Promise<MomoCreatePaymentResult>;
  async createCaptureWallet(input: MomoCreatePaymentInput): Promise<MomoCreatePaymentResult> {
    this.requests.push(structuredClone(input));
    this.createCalls += 1;
    if (this.dispatch) return this.dispatch(input);
    return {
      resultCode: 0,
      message: 'ok',
      payUrl: 'https://test-payment.momo.vn/pay',
      deeplink: null,
    };
  }
  verifyIpn(payload: MomoIpnPayload) {
    return this.verifier.verifyIpn(payload);
  }
}

async function occupiedTenancy(clock?: () => Date) {
  const transactions = createCoreTestTransactionManager();
  await transactions.run(async ({ repositories }) => {
    await repositories.organization.createOrganization({
      organizationId: orgId,
      primaryOwnerUserId: operatorUserId,
      name: 'MoMo Org',
    });
    await repositories.property.createProperty({
      propertyId,
      organizationId: orgId,
      name: 'Property',
      lifecycleStatus: 'ACTIVE',
      operationalAddressText: 'Addr',
      operationalLocation: { longitude: 106.7, latitude: 10.8 },
      publicLocationProjection: { longitude: 106.71, latitude: 10.81 },
    });
    await repositories.property.createRoom({
      roomId,
      propertyId,
      nameOrLabel: 'P203',
      operationalState: 'OCCUPIED',
      recordLifecycle: 'ACTIVE',
    });
    await repositories.tenancy.createTenancy({
      tenancyId,
      roomId,
      status: 'ACTIVE',
      startedAt: '2026-09-01T00:00:00.000Z',
      endedAt: null,
      endReason: null,
    });
    await repositories.tenancy.insertParticipant({
      tenancyParticipantId: participantId,
      tenancyId,
      role: 'PRIMARY',
      userId: tenantUserId,
      joinedAt: '2026-09-01T00:00:00.000Z',
      leftAt: null,
    });
    await repositories.tenancy.insertTerms({
      tenancyTermsId: termsId,
      tenancyId,
      version: 1,
      rentAmount: '4000000.00',
      agreedDepositRequirement: '4000000.00',
      termStart: '2026-09-01',
      termEnd: '2027-09-01',
      billingDayOrDueDateRule: {},
      electricityArrangement: {},
      waterArrangement: {},
      minimalRentalConditions: {},
      effectiveFromCycleBoundary: '2026-09-01',
    });
  });
  const tenancy = new TenancyService(transactions);
  const billing = new BillingService(tenancy, transactions);
  const momo = new FakeMomo();
  const gateway = new PaymentGatewayService(tenancy, transactions, momo, undefined, clock);
  return { transactions, tenancy, billing, gateway, momo };
}

function signedIpn(
  overrides: Partial<MomoIpnPayload> & Pick<MomoIpnPayload, 'orderId' | 'requestId' | 'amount'>,
): MomoIpnPayload {
  const payload: MomoIpnPayload = {
    partnerCode: TEST_MOMO.partnerCode,
    orderInfo: 'TROOI',
    orderType: 'momo_wallet',
    transId: 1,
    resultCode: 0,
    message: 'Successful.',
    payType: 'qr',
    responseTime: 1,
    extraData: tenancyId,
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

test('creating a MoMo checkout does not insert a Payment', async () => {
  const { billing, gateway } = await occupiedTenancy();
  const checkout = await gateway.createCheckout(
    { tenancyId, amount: '4470000.00' },
    tenantUserId,
    randomUUID(),
  );
  assert.equal(checkout.status, 'CREATED');
  assert.ok(checkout.payUrl);
  assert.equal(checkout.resultingPaymentId, undefined);
  const payments = await billing.findPaymentsByTenancyId(tenancyId);
  assert.equal(payments.length, 0);
});

test('verified IPN creates one GATEWAY PROVIDER_VERIFIED Payment and is idempotent', async () => {
  const { billing, gateway, transactions } = await occupiedTenancy();
  const checkout = await gateway.createCheckout(
    { tenancyId, amount: '4470000.00' },
    tenantUserId,
    randomUUID(),
  );
  const stored = await transactions.run(({ repositories }) =>
    repositories.finance.findGatewayCheckout(checkout.id),
  );
  assert.ok(stored);
  const ipn = signedIpn({
    orderId: stored.providerOrderId,
    requestId: stored.providerRequestId,
    amount: 4470000,
  });
  await gateway.handleMomoIpn(ipn);
  await gateway.handleMomoIpn(ipn);
  const payments = await billing.findPaymentsByTenancyId(tenancyId);
  assert.equal(payments.length, 1);
  assert.equal(payments[0]?.source, 'GATEWAY');
  assert.equal(payments[0]?.verification, 'PROVIDER_VERIFIED');
  assert.equal(payments[0]?.amount, '4470000.00');
  const confirmed = await gateway.findCheckout(checkout.id, tenantUserId);
  assert.equal(confirmed.status, 'SUCCEEDED');
  assert.equal(confirmed.resultingPaymentId, payments[0]?.id);
  const allocations = await transactions.run(({ repositories }) =>
    repositories.finance.findPaymentAllocations(payments[0]!.id),
  );
  assert.equal(allocations.length, 0);
});

test('invalid IPN signature does not create a Payment', async () => {
  const { billing, gateway, transactions } = await occupiedTenancy();
  const checkout = await gateway.createCheckout(
    { tenancyId, amount: '4470000.00' },
    tenantUserId,
    randomUUID(),
  );
  const stored = await transactions.run(({ repositories }) =>
    repositories.finance.findGatewayCheckout(checkout.id),
  );
  assert.ok(stored);
  await assert.rejects(
    () =>
      gateway.handleMomoIpn({
        orderId: stored.providerOrderId,
        requestId: stored.providerRequestId,
        amount: 4470000,
        resultCode: 0,
        signature: 'deadbeef',
      }),
    /Invalid MoMo IPN signature/,
  );
  assert.equal((await billing.findPaymentsByTenancyId(tenancyId)).length, 0);
});

test('IPN amount mismatch fails checkout without Payment', async () => {
  const { billing, gateway, transactions } = await occupiedTenancy();
  const checkout = await gateway.createCheckout(
    { tenancyId, amount: '4470000.00' },
    tenantUserId,
    randomUUID(),
  );
  const stored = await transactions.run(({ repositories }) =>
    repositories.finance.findGatewayCheckout(checkout.id),
  );
  assert.ok(stored);
  await gateway.handleMomoIpn(
    signedIpn({
      orderId: stored.providerOrderId,
      requestId: stored.providerRequestId,
      amount: 1000,
    }),
  );
  assert.equal((await billing.findPaymentsByTenancyId(tenancyId)).length, 0);
  assert.equal((await gateway.findCheckout(checkout.id, tenantUserId)).status, 'FAILED');
});

test('MoMo checkout does not fund Deposit', async () => {
  const { billing, gateway, transactions } = await occupiedTenancy();
  await billing.createDeposit(tenancyId);
  const before = await billing.findDepositProjectionForTenancy(tenancyId);
  const checkout = await gateway.createCheckout(
    { tenancyId, amount: '4000000.00' },
    tenantUserId,
    randomUUID(),
  );
  const stored = await transactions.run(({ repositories }) =>
    repositories.finance.findGatewayCheckout(checkout.id),
  );
  assert.ok(stored);
  await gateway.handleMomoIpn(
    signedIpn({
      orderId: stored.providerOrderId,
      requestId: stored.providerRequestId,
      amount: 4000000,
    }),
  );
  const after = await billing.findDepositProjectionForTenancy(tenancyId);
  assert.equal(before.fundedAmount, after.fundedAmount);
  assert.equal(after.fundedAmount, '0.00');
  assert.equal((await billing.findPaymentsByTenancyId(tenancyId)).length, 1);
});

test('intent is committed before provider dispatch', async () => {
  const { gateway, transactions, momo } = await occupiedTenancy();
  momo.dispatch = async (input) => {
    assert.ok(input);
    const intent = await transactions.run(({ repositories }) =>
      repositories.finance.findGatewayCheckoutByOrderId(input.orderId),
    );
    assert.ok(intent, 'provider must observe committed intent');
    return {
      resultCode: 0,
      message: 'ok',
      payUrl: 'https://test-payment.momo.vn/pay',
      deeplink: null,
    };
  };
  const checkout = await gateway.createCheckout({ tenancyId, amount: '1000.00' }, tenantUserId, randomUUID());
  assert.equal(checkout.status, 'CREATED', 'provider observation must succeed, not resolve as uncertainty');
});

test('lost_response_replay_reuses_provider_identity', async () => {
  const { gateway, momo, transactions, billing } = await occupiedTenancy();
  const key = randomUUID();
  momo.dispatch = async () => {
    throw new Error('provider accepted, response connection lost');
  };
  const original = await gateway.createCheckout(
    { tenancyId, amount: '1000.00' },
    tenantUserId,
    key,
  );
  assert.equal(original.status, 'UNKNOWN');
  assert.equal(original.replayAllowed, true);
  assert.equal((await gateway.findCheckout(original.id, tenantUserId)).status, 'UNKNOWN');
  assert.equal(momo.createCalls, 1, 'GET cannot dispatch');
  momo.dispatch = undefined;
  const replayed = await gateway.createCheckout({ tenancyId, amount: '1000' }, tenantUserId, key);
  assert.equal(replayed.id, original.id);
  const [firstDispatch, secondDispatch] = momo.requests;
  assert.ok(firstDispatch && secondDispatch);
  assert.equal(secondDispatch.requestId, firstDispatch.requestId);
  assert.equal(secondDispatch.orderId, firstDispatch.orderId);
  assert.deepEqual(secondDispatch, firstDispatch);
  assert.equal((await billing.findPaymentsByTenancyId(tenancyId)).length, 0);
  const responseLost = await gateway.createCheckout(
    { tenancyId, amount: '1000.0' },
    tenantUserId,
    key,
  );
  assert.equal(responseLost.id, original.id);
  assert.equal(momo.createCalls, 2, 'lost client response returns accepted durable state');
  const stored = await transactions.run(({ repositories }) =>
    repositories.finance.findGatewayCheckout(original.id),
  );
  assert.ok(stored?.requestSnapshot);
  assert.equal(stored.requestSnapshot.autoCapture, true);
  assert.equal(
    stored.requestSnapshot.extraData,
    Buffer.from(JSON.stringify({ checkoutId: original.id })).toString('base64'),
  );
});

test('key namespace, normalized fingerprint, and current authorization are enforced', async () => {
  const { gateway, momo, transactions } = await occupiedTenancy();
  const key = randomUUID();
  const first = await gateway.createCheckout({ tenancyId, amount: '1000' }, tenantUserId, key);
  const same = await gateway.createCheckout(
    { tenancyId, amount: '1000.00' },
    tenantUserId,
    key.toUpperCase(),
  );
  assert.equal(same.id, first.id);
  await assert.rejects(
    gateway.createCheckout({ tenancyId, amount: '2000' }, tenantUserId, key),
    /payload differs/,
  );
  const other = await gateway.createCheckout({ tenancyId, amount: '1000' }, operatorUserId, key);
  assert.notEqual(other.id, first.id);
  assert.equal(
    (await gateway.findCheckout(first.id, operatorUserId)).replayBlockedReason,
    'INTENT_OWNER_REQUIRED',
  );
  await transactions.run(async ({ repositories }) => {
    const p = (await repositories.tenancy.findParticipantsByTenancy(tenancyId))[0]!;
    await repositories.tenancy.updateParticipant({ ...p, leftAt: '2026-10-05T00:00:00.000Z' });
  });
  assert.equal(
    (await gateway.findCheckout(first.id, tenantUserId)).replayBlockedReason,
    'TENANCY_WRITE_ACCESS_REQUIRED',
  );
  await assert.rejects(gateway.createCheckout({ tenancyId, amount: '1000' }, tenantUserId, key));
  assert.equal(momo.createCalls, 2);
});

test('insert failure prevents provider call', async () => {
  const { gateway, momo, transactions } = await occupiedTenancy();
  await transactions.run(async ({ repositories }) => {
    repositories.finance.insertGatewayCheckout = async () => {
      throw new Error('insert failure');
    };
  });
  await assert.rejects(
    gateway.createCheckout({ tenancyId, amount: '1000' }, tenantUserId, randomUUID()),
    /insert failure/,
  );
  assert.equal(momo.createCalls, 0);
});

test('completion failure and expired crash lease recover with the same persisted payload', async () => {
  let now = new Date('2026-10-05T00:00:00.000Z');
  const { gateway, momo, transactions } = await occupiedTenancy(() => now);
  const key = randomUUID();
  await transactions.run(async ({ repositories }) => {
    const update = repositories.finance.updateGatewayCheckout;
    repositories.finance.updateGatewayCheckout = async (record) => {
      repositories.finance.updateGatewayCheckout = update;
      throw new Error('local completion failed');
    };
  });
  await assert.rejects(
    gateway.createCheckout({ tenancyId, amount: '1000' }, tenantUserId, key),
    /local completion failed/,
  );
  const waiting = await gateway.createCheckout({ tenancyId, amount: '1000' }, tenantUserId, key);
  assert.equal(waiting.replayBlockedReason, 'DISPATCH_IN_PROGRESS');
  assert.equal(momo.createCalls, 1);
  now = new Date(now.getTime() + 60000);
  assert.equal((await gateway.findCheckout(waiting.id, tenantUserId)).status, 'UNKNOWN');
  assert.equal(momo.createCalls, 1);
  const restored = new PaymentGatewayService(
    new TenancyService(transactions),
    transactions,
    momo,
    undefined,
    () => now,
  );
  const recovered = await restored.createCheckout({ tenancyId, amount: '1000' }, tenantUserId, key);
  assert.equal(recovered.id, waiting.id);
  assert.equal(recovered.status, 'CREATED');
  assert.deepEqual(momo.requests[1], momo.requests[0]);
});

test('concurrent same key has one dispatcher; late completion cannot erase callback settlement', async () => {
  const { gateway, momo, transactions, billing } = await occupiedTenancy();
  const key = randomUUID();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let entered!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  momo.dispatch = async (input) => {
    entered();
    await gate;
    return { resultCode: 1006, message: 'late failure', payUrl: null, deeplink: null };
  };
  const first = gateway.createCheckout({ tenancyId, amount: '1000' }, tenantUserId, key);
  await started;
  const second = await gateway.createCheckout({ tenancyId, amount: '1000' }, tenantUserId, key);
  assert.equal(second.replayBlockedReason, 'DISPATCH_IN_PROGRESS');
  assert.equal(momo.createCalls, 1);
  const stored = await transactions.run(({ repositories }) =>
    repositories.finance.findGatewayCheckout(second.id),
  );
  assert.ok(stored);
  await gateway.handleMomoIpn(
    signedIpn({
      orderId: stored.providerOrderId,
      requestId: stored.providerRequestId,
      amount: 1000,
    }),
  );
  release();
  assert.equal((await first).status, 'SUCCEEDED');
  assert.equal((await billing.findPaymentsByTenancyId(tenancyId)).length, 1);
});

test('first dispatch window ends exactly at 31 days without discarding correlation', async () => {
  let now = new Date('2026-10-05T00:00:00.000Z');
  const { gateway, momo } = await occupiedTenancy(() => now);
  momo.dispatch = async () => {
    throw new Error('timeout');
  };
  const key = randomUUID();
  const first = await gateway.createCheckout({ tenancyId, amount: '1000' }, tenantUserId, key);
  now = new Date(now.getTime() + 31 * 86400000 - 1);
  assert.equal((await gateway.findCheckout(first.id, tenantUserId)).replayAllowed, true);
  now = new Date(now.getTime() + 1);
  const replay = await gateway.createCheckout({ tenancyId, amount: '1000' }, tenantUserId, key);
  assert.equal(replay.id, first.id);
  assert.equal(replay.replayBlockedReason, 'IDEMPOTENCY_WINDOW_ELAPSED');
  assert.equal(momo.createCalls, 1);
});

test('pending, reconcile, verification, and final outcomes stop POST replay without Payment', async () => {
  for (const [code, status, reason] of [
    [1000, 'UNKNOWN', 'PROVIDER_PENDING'],
    [9000, 'UNKNOWN', 'PROVIDER_PENDING'],
    [40, 'UNKNOWN', 'RECONCILIATION_REQUIRED'],
    [2019, 'UNKNOWN', 'RECONCILIATION_REQUIRED'],
    [10, 'UNKNOWN', 'PROVIDER_CONFIGURATION_REQUIRED'],
    [1006, 'FAILED', 'CHECKOUT_NOT_REPLAYABLE'],
  ] as const) {
    const { gateway, momo, billing } = await occupiedTenancy();
    momo.dispatch = async () => ({
      resultCode: code,
      message: 'provider',
      payUrl: null,
      deeplink: null,
    });
    const key = randomUUID();
    const first = await gateway.createCheckout({ tenancyId, amount: '1000' }, tenantUserId, key);
    assert.equal(first.status, status);
    assert.equal(first.replayBlockedReason, reason);
    assert.equal(
      (await gateway.createCheckout({ tenancyId, amount: '1000' }, tenantUserId, key)).id,
      first.id,
    );
    assert.equal(momo.createCalls, 1);
    assert.equal((await billing.findPaymentsByTenancyId(tenancyId)).length, 0);
  }
  const { gateway, momo } = await occupiedTenancy();
  momo.dispatch = async () => {
    throw new MomoVerificationError('invalid signature');
  };
  const key = randomUUID();
  const first = await gateway.createCheckout({ tenancyId, amount: '1000' }, tenantUserId, key);
  assert.equal(first.replayBlockedReason, 'RESPONSE_VERIFICATION_REQUIRED');
  assert.equal(first.payUrl, undefined);
  await gateway.createCheckout({ tenancyId, amount: '1000' }, tenantUserId, key);
  assert.equal(momo.createCalls, 1);
});

test('ENDING remains writable but ENDED blocks even an operator; changed tenancy conflicts', async () => {
  const { gateway, transactions, momo } = await occupiedTenancy();
  const key = randomUUID();
  await transactions.run(async ({ repositories }) => {
    const current = await repositories.tenancy.findTenancy(tenancyId);
    assert.ok(current);
    await repositories.tenancy.updateTenancy({ ...current, status: 'ENDING' });
    await repositories.tenancy.createTenancy({ ...current, tenancyId: 'second-tenancy' });
  });
  await gateway.createCheckout({ tenancyId, amount: '1000' }, operatorUserId, key);
  await assert.rejects(
    gateway.createCheckout({ tenancyId: 'second-tenancy', amount: '1000' }, operatorUserId, key),
    /payload differs/,
  );
  await transactions.run(async ({ repositories }) => {
    const current = await repositories.tenancy.findTenancy(tenancyId);
    assert.ok(current);
    await repositories.tenancy.updateTenancy({ ...current, status: 'ENDED' });
  });
  await assert.rejects(
    gateway.createCheckout({ tenancyId, amount: '1000' }, operatorUserId, key),
    /not writable/,
  );
  assert.equal(momo.createCalls, 1);
});

test('expired owner completion cannot erase newer lease outcome', async () => {
  let now = new Date('2026-10-05T00:00:00.000Z');
  const { gateway, momo } = await occupiedTenancy(() => now);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let entered!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  momo.dispatch = async () => {
    if (momo.createCalls === 1) {
      entered();
      await gate;
      return { resultCode: 1006, message: 'stale final failure', payUrl: null, deeplink: null };
    }
    return {
      resultCode: 0,
      message: 'accepted',
      payUrl: 'https://test-payment.momo.vn/pay',
      deeplink: null,
    };
  };
  const key = randomUUID();
  const first = gateway.createCheckout({ tenancyId, amount: '1000' }, tenantUserId, key);
  await started;
  now = new Date(now.getTime() + 60000);
  const newer = await gateway.createCheckout({ tenancyId, amount: '1000' }, tenantUserId, key);
  assert.equal(newer.status, 'CREATED');
  release();
  assert.equal((await first).status, 'CREATED');
  assert.deepEqual(momo.requests[0], momo.requests[1]);
});
