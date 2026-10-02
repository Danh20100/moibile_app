import assert from 'node:assert/strict';

import { createDatabaseClient } from '../../../src/infrastructure/database/database.client';
import { loadDatabaseConfig } from '../../../src/infrastructure/database/database.config';
import { DISCOVERY_FIXTURE as fixture } from '../fixtures/discovery';
import { assertSafeE2eDatabaseUrl } from '../seed/database';

interface PublicListingEnvelope {
  success: boolean;
  data: Array<{
    id: string;
    roomId: string;
    status: string;
    publicTitle: string;
    publicDescription: string;
    publicPriceProjection: string;
    publicLocationProjection: { longitude: number; latitude: number };
    operationalAddressText?: unknown;
  }>;
}

async function assertDiscovery(): Promise<void> {
  assertSafeE2eDatabaseUrl(process.env.DATABASE_URL);
  const backendPort = process.env.BACKEND_PORT?.trim() || '3000';
  const response = await fetch(`http://127.0.0.1:${backendPort}/api/v1/listings/public`);
  assert.equal(response.status, 200, 'GET /listings/public must return HTTP 200');

  const envelope = (await response.json()) as PublicListingEnvelope;
  assert.equal(envelope.success, true, 'public listing response envelope must succeed');
  const listing = envelope.data.find((value) => value.id === fixture.ids.listingId);
  assert.ok(listing, 'E2E PUBLISHED Listing must be returned by the public API');
  assert.equal(listing.roomId, fixture.ids.roomId);
  assert.equal(listing.status, 'published');
  assert.equal(listing.publicTitle, fixture.listing.publicTitle);
  assert.equal(listing.publicPriceProjection, fixture.listing.publicPriceProjection);
  assert.deepEqual(listing.publicLocationProjection, fixture.publicLocationProjection);
  assert.equal(
    Object.prototype.hasOwnProperty.call(listing, 'operationalAddressText'),
    false,
    'public Listing projection must not expose operationalAddressText',
  );
  const db = createDatabaseClient(loadDatabaseConfig(process.env));
  try {
    const databaseListing = await db
      .selectFrom('listings')
      .select(['listing_id', 'room_id', 'status', 'public_title', 'public_price_projection'])
      .where('listing_id', '=', fixture.ids.listingId)
      .executeTakeFirst();
    assert.ok(databaseListing, 'E2E Listing must exist in PostgreSQL');
    assert.equal(databaseListing.room_id, fixture.ids.roomId);
    assert.equal(databaseListing.status, 'PUBLISHED');
    assert.equal(databaseListing.public_title, fixture.listing.publicTitle);
    assert.equal(databaseListing.public_price_projection, fixture.listing.publicPriceProjection);

    const statusEvents = await db
      .selectFrom('listing_status_events')
      .select(['listing_status_event_id', 'to_status'])
      .where('listing_id', '=', fixture.ids.listingId)
      .execute();
    assert.equal(statusEvents.length, 1, 'deterministic seed must create one Listing status event');
    assert.equal(statusEvents[0]?.listing_status_event_id, fixture.ids.listingPublishedEventId);
    assert.equal(statusEvents[0]?.to_status, 'PUBLISHED');

    const inquiries = await db
      .selectFrom('inquiries')
      .select('inquiry_id')
      .where('listing_id', '=', fixture.ids.listingId)
      .execute();
    assert.equal(
      inquiries.length,
      0,
      'Discovery/detail flows must not create Inquiry side effects',
    );
  } finally {
    await db.destroy();
  }

  console.log('E2E assertions PASS: public API + PostgreSQL + discovery invariants');
}

void assertDiscovery().catch((error: unknown) => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : error);
  process.exitCode = 1;
});
