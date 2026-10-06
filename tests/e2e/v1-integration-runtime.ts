import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { UnauthorizedException } from '@nestjs/common';

import { ResourceAuthorizationService } from '../../src/common/auth/resource-authorization.service';
import { googlePrincipalUserId } from '../../src/common/identity/deterministic-user-id';
import { HttpMomoPaymentClient } from '../../src/modules/payment-gateway/momo/momo-client';
import { PaymentGatewayService } from '../../src/modules/payment-gateway/services/payment-gateway.service';
import { AuditTrustService } from '../../src/modules/audit-trust/services/audit-trust.service';
import { TenancyService } from '../../src/modules/tenancy/services/tenancy.service';
import {
  startGatewayHttpHarness,
  startTrustHttpHarness,
} from '../core/support/payment-gateway-http-harness';
import {
  TEST_MOMO,
  gatewayFixture,
  signedCheckoutIpn,
} from '../integration/persistence/gateway-test-support';

const ISSUER = 'https://accounts.google.com';
const MEMBER = 'v1-runtime-member';
const STRANGER = 'v1-runtime-stranger';

const url = process.env.TEST_DATABASE_URL ?? '';
if (!url.includes('trooi_test')) {
  console.error(
    'v1-integration-runtime: TEST_DATABASE_URL must target trooi_test. Live Google/MoMo are not claimed.',
  );
  process.exit(1);
}

const verifier = {
  async verify(token: string) {
    if (token === 'member') return { issuer: ISSUER, subject: MEMBER };
    if (token === 'stranger') return { issuer: ISSUER, subject: STRANGER };
    throw new UnauthorizedException('Invalid test credential');
  },
};

async function persistedHttp() {
  const fixture = await gatewayFixture(url);
  const memberId = googlePrincipalUserId(ISSUER, MEMBER);
  const strangerId = googlePrincipalUserId(ISSUER, STRANGER);
  const listing = await fixture.listings.findListing(fixture.ids.listing);
  assert.ok(listing);
  await fixture.listings.updateListing({ ...listing, status: 'PUBLISHED' });
  await fixture.identity.ensureUser(memberId);
  await fixture.identity.ensureUser(strangerId);
  await fixture.tenancies.insertParticipant({
    tenancyParticipantId: randomUUID(),
    tenancyId: fixture.ids.tenancy,
    userId: memberId,
    role: 'OCCUPANT',
    joinedAt: '2026-01-01T00:00:00.000Z',
    leftAt: null,
  });
  const proto = new HttpMomoPaymentClient(TEST_MOMO);
  const authz = new ResourceAuthorizationService(fixture.manager);
  const gateway = new PaymentGatewayService(
    new TenancyService(fixture.manager),
    fixture.manager,
    {
      snapshot: (id) => proto.snapshot(id),
      verifyIpn: proto.verifyIpn.bind(proto),
      async createCaptureWallet() {
        return {
          resultCode: 0,
          message: 'ok',
          payUrl: 'https://test-payment.momo.vn/pay',
          deeplink: null,
        };
      },
    },
    authz,
  );
  const checkoutApp = await startGatewayHttpHarness({ service: gateway, authz, verifier });
  const trustApp = await startTrustHttpHarness({
    service: new AuditTrustService(fixture.manager),
    verifier,
  });
  try {
    const denied = await fetch(`${checkoutApp.baseUrl}/finance/checkouts`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer stranger',
        'idempotency-key': randomUUID(),
      },
      body: JSON.stringify({ tenancyId: fixture.ids.tenancy, amount: fixture.amount }),
    });
    assert.equal(denied.status, 403);

    const created = await fetch(`${checkoutApp.baseUrl}/finance/checkouts`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer member',
        'idempotency-key': randomUUID(),
      },
      body: JSON.stringify({ tenancyId: fixture.ids.tenancy, amount: fixture.amount }),
    });
    assert.equal(created.status, 201);
    const checkout = (await created.json()) as { data: { id: string; status: string } };
    assert.notEqual(checkout.data.status, 'SUCCEEDED');
    const stored = await fixture.finance.findGatewayCheckout(checkout.data.id);
    assert.ok(stored);
    assert.equal((await fixture.finance.findPaymentsForTenancy(fixture.ids.tenancy)).length, 0);

    const ipn = await fetch(`${checkoutApp.baseUrl}/finance/checkouts/momo/ipn`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(signedCheckoutIpn(stored)),
    });
    assert.equal(ipn.status, 204);
    assert.equal(await ipn.text(), '');
    const payments = await fixture.finance.findPaymentsForTenancy(fixture.ids.tenancy);
    assert.equal(payments.length, 1);
    assert.equal((await fixture.finance.findPaymentAllocations(payments[0]!.paymentId)).length, 0);
    assert.equal((await fixture.finance.findReceiptsForPayment(payments[0]!.paymentId)).length, 0);
    assert.equal(await fixture.finance.findDepositForTenancy(fixture.ids.tenancy), undefined);

    const report = await fetch(`${trustApp.baseUrl}/audit-trust/reports`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer stranger' },
      body: JSON.stringify({ listingId: fixture.ids.listing, reason: 'SPAM' }),
    });
    assert.equal(report.status, 201);
    const body = (await report.json()) as { data: { reporterUserId: string; status: string } };
    assert.equal(body.data.reporterUserId, googlePrincipalUserId(ISSUER, STRANGER));
    assert.equal(body.data.status, 'SUBMITTED');
    assert.equal((await fixture.listings.findListing(fixture.ids.listing))?.status, 'PUBLISHED');
    console.log('v1-integration-runtime: persisted HTTP checkout and trust passed. Live Google/MoMo are not claimed.');
  } finally {
    await checkoutApp.close();
    await trustApp.close();
    await fixture.db.destroy();
  }
}

persistedHttp()
  .then(() => {
    const child = spawnSync(
      process.execPath,
      [
        '--import',
        'tsx',
        '--test',
        '--test-concurrency=1',
        'tests/integration/persistence/payment-gateway.integration.ts',
        'tests/integration/persistence/trust-submission.integration.ts',
      ],
      { stdio: 'inherit', env: process.env },
    );
    process.exit(child.status ?? 1);
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
