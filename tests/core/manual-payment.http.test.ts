import assert from 'node:assert/strict';
import test from 'node:test';
import { UnauthorizedException } from '@nestjs/common';
import { ResourceAuthorizationService } from '../../src/common/auth/resource-authorization.service';
import {
  verifyGoogleIdToken,
  type GoogleIdTokenVerifier,
} from '../../src/integrations/google-identity';
import { BillingService } from '../../src/modules/billing/services/billing.service';
import { TenancyService } from '../../src/modules/tenancy/services/tenancy.service';
import { createCoreTestTransactionManager } from './support/in-memory-transaction-manager';
import { startBillingHttpHarness } from './support/payment-gateway-http-harness';

const manual = {
  tenancyId: 'tenancy-1',
  amount: '100.00',
  source: 'MANUAL_CASH',
  confirmedAt: '2026-10-05T00:00:00.000Z',
};
async function harness() {
  const verifier: GoogleIdTokenVerifier = {
    async verify(token) {
      if (!['operator', 'tenant', 'outsider'].includes(token))
        throw new UnauthorizedException('Invalid test credential');
      return { issuer: 'https://accounts.google.com', subject: token };
    },
  };
  const operator = await verifyGoogleIdToken(verifier, 'operator');
  const tenant = await verifyGoogleIdToken(verifier, 'tenant');
  const transactions = createCoreTestTransactionManager();
  await transactions.run(async ({ repositories: r }) => {
    await r.organization.createOrganization({
      organizationId: 'org-1',
      primaryOwnerUserId: operator.userId,
      name: 'Rooms',
    });
    await r.property.createProperty({
      propertyId: 'property-1',
      organizationId: 'org-1',
      name: 'Property',
      lifecycleStatus: 'ACTIVE',
      operationalAddressText: 'Address',
      operationalLocation: { latitude: 10, longitude: 106 },
      publicLocationProjection: { latitude: 10, longitude: 106 },
    });
    await r.property.createRoom({
      roomId: 'room-1',
      propertyId: 'property-1',
      nameOrLabel: 'Room',
      operationalState: 'OCCUPIED',
      recordLifecycle: 'ACTIVE',
    });
    await r.tenancy.createTenancy({
      tenancyId: 'tenancy-1',
      roomId: 'room-1',
      status: 'ACTIVE',
      startedAt: manual.confirmedAt,
      endedAt: null,
      endReason: null,
    });
    await r.tenancy.insertParticipant({
      tenancyParticipantId: 'participant-1',
      tenancyId: 'tenancy-1',
      userId: tenant.userId,
      role: 'PRIMARY',
      joinedAt: manual.confirmedAt,
      leftAt: null,
    });
  });
  const service = new BillingService(new TenancyService(transactions), transactions);
  const app = await startBillingHttpHarness({
    service,
    authz: new ResourceAuthorizationService(transactions),
    verifier,
  });
  return { ...app, service };
}
function post(baseUrl: string, body: unknown, token?: string) {
  return fetch(`${baseUrl}/finance/payments`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}
test('manual_gateway_provenance_is_rejected', async (t) => {
  const app = await harness();
  t.after(app.close);
  const spoofedGateway = await post(app.baseUrl, { ...manual, source: 'GATEWAY' }, 'operator');
  const spoofedVerification = await post(
    app.baseUrl,
    { ...manual, verification: 'PROVIDER_VERIFIED' },
    'operator',
  );
  const tenantManual = await post(app.baseUrl, manual, 'tenant');
  const insertedPayments = await app.service.findPaymentsByTenancyId(manual.tenancyId);
  assert.equal(spoofedGateway.status, 400);
  assert.equal(spoofedVerification.status, 400);
  assert.equal(tenantManual.status, 403);
  assert.equal(insertedPayments.length, 0);
});

test('operator records both manual channels with server verification and real auth guard', async (t) => {
  const app = await harness();
  t.after(app.close);
  for (const token of [undefined, 'invalid', 'outsider']) {
    const response = await post(app.baseUrl, manual, token);
    assert.equal(response.status, token === 'outsider' ? 403 : 401);
    await response.text();
  }
  assert.deepEqual(await app.service.findPaymentsByTenancyId(manual.tenancyId), []);
  for (const source of ['MANUAL_CASH', 'MANUAL_TRANSFER']) {
    const response = await post(app.baseUrl, { ...manual, source }, 'operator');
    assert.equal(response.status, 201);
    const body = await response.json();
    assert.equal(body.success, true);
    assert.equal(body.data.source, source);
    assert.equal(body.data.verification, 'USER_RECORDED');
    assert.equal(typeof body.timestamp, 'string');
    assert.equal((await app.service.findPaymentById(body.data.id)).verification, 'USER_RECORDED');
  }
});
