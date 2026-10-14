import assert from 'node:assert/strict';
import test from 'node:test';

import { RentalTransactionCoordinator } from '../../src/persistence/guards/rental-transaction-coordinator';
import { TenancyService } from '../../src/modules/tenancy/services/tenancy.service';
import { ListingService } from '../../src/modules/listing/services/listing.service';
import { createActiveProperty, createCoreFoundationHarness } from './support/core-foundation.harness';

test('Room archive is atomic and fails closed when any Tenancy history exists', async () => {
  const harness = createCoreFoundationHarness();
  const propertyId = await createActiveProperty(harness);
  const room = await harness.roomService.create({ propertyId, nameOrLabel: '201' });
  const tenancies = new TenancyService(harness.transactions);
  await tenancies.createDraft(room.id);
  await harness.roomService.transitionOperationalState(room.id, 'inactive', 'manual');

  const lifecycle = new RentalTransactionCoordinator(harness.transactions);
  await assert.rejects(lifecycle.archiveRoom(room.id), /Tenancy or incident history/);
  assert.equal((await harness.roomService.findById(room.id)).recordLifecycle, 'active');
});

test('blocked archive leaves a published Listing and active Room unchanged', async () => {
  const harness = createCoreFoundationHarness();
  const propertyId = await createActiveProperty(harness);
  const room = await harness.roomService.create({ propertyId, nameOrLabel: '203' });
  const listings = new ListingService(harness.transactions);
  const listing = await listings.createDraft({
    roomId: room.id,
    publicTitle: 'Room 203',
    publicDescription: 'Available room',
    publicPriceProjection: '3500000.00',
    publicLocationProjection: { latitude: 21, longitude: 105 },
  });
  await new RentalTransactionCoordinator(harness.transactions).publishListing(listing.id);
  await new TenancyService(harness.transactions).createDraft(room.id);

  await assert.rejects(new RentalTransactionCoordinator(harness.transactions).archiveRoom(room.id), /Tenancy or incident history/);
  assert.equal((await harness.roomService.findById(room.id)).operationalState, 'vacant');
  assert.equal((await listings.findByRoomId(room.id))[0].status, 'published');
});

test('eligible published Room archives atomically without client deactivation calls', async () => {
  const harness = createCoreFoundationHarness();
  const propertyId = await createActiveProperty(harness);
  const room = await harness.roomService.create({ propertyId, nameOrLabel: '204' });
  const listings = new ListingService(harness.transactions);
  const listing = await listings.createDraft({
    roomId: room.id,
    publicTitle: 'Room 204',
    publicDescription: 'Available room',
    publicPriceProjection: '3500000.00',
    publicLocationProjection: { latitude: 21, longitude: 105 },
  });
  const lifecycle = new RentalTransactionCoordinator(harness.transactions);
  await lifecycle.publishListing(listing.id);

  await lifecycle.archiveRoom(room.id);
  assert.equal((await harness.roomService.findById(room.id)).recordLifecycle, 'archived');
  assert.equal((await listings.findByRoomId(room.id))[0].status, 'archived');
});

test('eligible Room archive writes a lifecycle tombstone without deleting its Property', async () => {
  const harness = createCoreFoundationHarness();
  const propertyId = await createActiveProperty(harness);
  const room = await harness.roomService.create({ propertyId, nameOrLabel: '202' });
  await harness.roomService.transitionOperationalState(room.id, 'inactive', 'manual');

  await new RentalTransactionCoordinator(harness.transactions).archiveRoom(room.id);
  assert.equal((await harness.roomService.findById(room.id)).recordLifecycle, 'archived');
  assert.equal((await harness.propertyService.findById(propertyId)).lifecycleStatus, 'active');
});
