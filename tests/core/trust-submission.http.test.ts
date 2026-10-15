import { UnauthorizedException } from '@nestjs/common';
import assert from 'node:assert/strict';
import test from 'node:test';
import { googlePrincipalUserId } from '../../src/common/identity/deterministic-user-id';
import { AuditTrustService } from '../../src/modules/audit-trust/services/audit-trust.service';
import { createCoreTestTransactionManager } from './support/in-memory-transaction-manager';
import { startTrustHttpHarness } from './support/payment-gateway-http-harness';

const listing = {
  listingId: 'listing-1',
  roomId: 'room-1',
  status: 'PUBLISHED',
  publicTitle: 'T',
  publicDescription: 'D',
  publicPriceProjection: '1.00',
  publicLocationProjection: { longitude: 106.7, latitude: 10.8 },
};

async function harness() {
  const tx = createCoreTestTransactionManager();
  await tx.run(async ({ repositories }) => {
    await repositories.listing.createListing(listing);
    await repositories.listing.createListing({ ...listing, listingId: 'listing-draft', status: 'DRAFT' });
  });
  return startTrustHttpHarness({
    service: new AuditTrustService(tx),
    verifier: {
      async verify(token) {
        if (token !== 'test-credential') throw new UnauthorizedException('Invalid test credential');
        return { issuer: 'https://accounts.google.com', subject: 'http-test-user' };
      },
    },
  });
}

async function post(baseUrl: string, path: string, body: unknown, token?: string) {
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

test('trust report HTTP contract is principal-derived and listing-only', async () => {
  const { baseUrl, close } = await harness();
  try {
    const unauth = await post(baseUrl, '/audit-trust/reports', {
      listingId: 'listing-1',
      reason: 'SPAM',
    });
    assert.equal(unauth.status, 401);

    const spoof = await post(
      baseUrl,
      '/audit-trust/reports',
      { listingId: 'listing-1', reason: 'SPAM', reporterUserId: 'spoof', status: 'RESOLVED' },
      'test-credential',
    );
    assert.equal(spoof.status, 400);

    const none = await post(baseUrl, '/audit-trust/reports', { reason: 'SPAM' }, 'test-credential');
    assert.equal(none.status, 400);
    const both = await post(
      baseUrl,
      '/audit-trust/reports',
      { listingId: 'listing-1', reviewId: 'review-1', reason: 'SPAM' },
      'test-credential',
    );
    assert.equal(both.status, 400);

    const missing = await post(
      baseUrl,
      '/audit-trust/reports',
      { listingId: 'missing', reason: 'SPAM' },
      'test-credential',
    );
    assert.equal(missing.status, 404);
    const unpublished = await post(
      baseUrl,
      '/audit-trust/reports',
      { listingId: 'listing-draft', reason: 'SPAM' },
      'test-credential',
    );
    assert.equal(unpublished.status, 404);

    const review = await post(
      baseUrl,
      '/audit-trust/reports',
      { reviewId: 'review-1', reason: 'SPAM' },
      'test-credential',
    );
    assert.equal(review.status, 422);

    const created = await post(
      baseUrl,
      '/audit-trust/reports',
      { listingId: 'listing-1', reason: 'INCORRECT_INFORMATION', note: 'sai mô tả' },
      'test-credential',
    );
    assert.equal(created.status, 201);
    const payload = (await created.json()) as { data: { reporterUserId: string; listingId: string; status: string } };
    assert.equal(
      payload.data.reporterUserId,
      googlePrincipalUserId('https://accounts.google.com', 'http-test-user'),
    );
    assert.equal(payload.data.listingId, 'listing-1');
    assert.equal(payload.data.status, 'SUBMITTED');

    const listed = await fetch(`${baseUrl}/audit-trust/reports`, {
      headers: { authorization: 'Bearer test-credential' },
    });
    assert.equal(listed.status, 403);
  } finally {
    await close();
  }
});

test('trust report note and body limits stay route-local', async () => {
  const { baseUrl, close } = await harness();
  try {
    const longNote = await post(
      baseUrl,
      '/audit-trust/reports',
      { listingId: 'listing-1', reason: 'OTHER', note: 'n'.repeat(2001) },
      'test-credential',
    );
    assert.equal(longNote.status, 400);

    const oversized = await fetch(`${baseUrl}/audit-trust/reports`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer test-credential',
      },
      body: `{"listingId":"listing-1","reason":"OTHER","note":"${'x'.repeat(8200)}"}`,
    });
    assert.equal(oversized.status, 413);

    const fact = await post(
      baseUrl,
      '/audit-trust/facts',
      {
        actorId: 'user-1',
        action: 'probe',
        resourceType: 'listing',
        resourceId: 'listing-1',
        metadata: { blob: 'y'.repeat(9000) },
      },
      'test-credential',
    );
    assert.equal(fact.status, 201);
  } finally {
    await close();
  }
});
