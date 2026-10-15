import assert from 'node:assert/strict';
import test from 'node:test';

import { ListingService } from '../../src/modules/listing/services/listing.service';
import { DISCOVERY_FIXTURE } from '../e2e/fixtures/discovery';
import { seedDiscoveryFixture } from '../e2e/seed/seed';
import { createCoreTestTransactionManager } from './support/in-memory-transaction-manager';

test('Discovery E2E seed publishes through rental lifecycle and is idempotent', async () => {
  const transactions = createCoreTestTransactionManager();

  await seedDiscoveryFixture(transactions);
  await seedDiscoveryFixture(transactions);

  const listingService = new ListingService(transactions);
  const published = await listingService.findPublished();
  assert.equal(published.length, 1);
  assert.equal(published[0]?.id, DISCOVERY_FIXTURE.ids.listingId);
  assert.equal(published[0]?.status, 'published');
  assert.equal('operationalAddressText' in published[0]!, false);

  const events = await listingService.listStatusEvents(DISCOVERY_FIXTURE.ids.listingId);
  assert.equal(events.length, 1);
  assert.equal(events[0]?.fromStatus, 'draft');
  assert.equal(events[0]?.toStatus, 'published');
  assert.equal(events[0]?.actorType, 'USER');
  assert.equal(events[0]?.actorUserId, DISCOVERY_FIXTURE.ids.operatorUserId);
  assert.equal(events[0]?.reasonCode, DISCOVERY_FIXTURE.listing.publishReason);
});
