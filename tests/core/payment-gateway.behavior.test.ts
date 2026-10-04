import assert from 'node:assert/strict';
import test from 'node:test';

import { BillingService } from '../../src/modules/billing/services/billing.service';
import type { MomoIpnPayload, MomoPaymentClient } from '../../src/modules/payment-gateway/momo/momo-client';
import { HttpMomoPaymentClient } from '../../src/modules/payment-gateway/momo/momo-client';
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
  createCalls = 0;
  async createCaptureWallet() {
    this.createCalls += 1;
    return {
      resultCode: 0,
      message: 'ok',
      payUrl: 'https://test-payment.momo.vn/pay',
      deeplink: 'momo://app?token=demo',
    };
  }
  verifyIpn(payload: MomoIpnPayload) {
    return this.verifier.verifyIpn(payload);
  }
}

async function occupiedTenancy() {
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
  const gateway = new PaymentGatewayService(tenancy, transactions, momo);
  return { transactions, tenancy, billing, gateway, momo };
}

function signedIpn(overrides: Partial<MomoIpnPayload> & Pick<MomoIpnPayload, 'orderId' | 'requestId' | 'amount'>): MomoIpnPayload {
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
  const checkout = await gateway.createCheckout({ tenancyId, amount: '4470000.00' }, tenantUserId);
  assert.equal(checkout.status, 'CREATED');
  assert.ok(checkout.deeplink);
  assert.equal(checkout.resultingPaymentId, undefined);
  const payments = await billing.findPaymentsByTenancyId(tenancyId);
  assert.equal(payments.length, 0);
});

test('verified IPN creates one GATEWAY PROVIDER_VERIFIED Payment and is idempotent', async () => {
  const { billing, gateway, transactions } = await occupiedTenancy();
  const checkout = await gateway.createCheckout({ tenancyId, amount: '4470000.00' }, tenantUserId);
  const stored = await transactions.run(({ repositories }) => repositories.finance.findGatewayCheckout(checkout.id));
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
  const confirmed = await gateway.findCheckout(checkout.id);
  assert.equal(confirmed.status, 'SUCCEEDED');
  assert.equal(confirmed.resultingPaymentId, payments[0]?.id);
  const allocations = await transactions.run(({ repositories }) =>
    repositories.finance.findPaymentAllocations(payments[0]!.id),
  );
  assert.equal(allocations.length, 0);
});

test('invalid IPN signature does not create a Payment', async () => {
  const { billing, gateway, transactions } = await occupiedTenancy();
  const checkout = await gateway.createCheckout({ tenancyId, amount: '4470000.00' }, tenantUserId);
  const stored = await transactions.run(({ repositories }) => repositories.finance.findGatewayCheckout(checkout.id));
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
  const checkout = await gateway.createCheckout({ tenancyId, amount: '4470000.00' }, tenantUserId);
  const stored = await transactions.run(({ repositories }) => repositories.finance.findGatewayCheckout(checkout.id));
  assert.ok(stored);
  await gateway.handleMomoIpn(
    signedIpn({
      orderId: stored.providerOrderId,
      requestId: stored.providerRequestId,
      amount: 1000,
    }),
  );
  assert.equal((await billing.findPaymentsByTenancyId(tenancyId)).length, 0);
  assert.equal((await gateway.findCheckout(checkout.id)).status, 'FAILED');
});

test('MoMo checkout does not fund Deposit', async () => {
  const { billing, gateway, transactions } = await occupiedTenancy();
  await billing.createDeposit(tenancyId);
  const before = await billing.findDepositProjectionForTenancy(tenancyId);
  const checkout = await gateway.createCheckout({ tenancyId, amount: '4000000.00' }, tenantUserId);
  const stored = await transactions.run(({ repositories }) => repositories.finance.findGatewayCheckout(checkout.id));
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
