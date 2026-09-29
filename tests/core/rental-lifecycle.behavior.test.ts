import assert from 'node:assert/strict';
import test from 'node:test';

import { BadRequestException } from '@nestjs/common';

import { ListingService } from '../../src/modules/listing/services/listing.service';
import { PropertyService } from '../../src/modules/property/services/property.service';
import { RentalLifecycleCoordinator } from '../../src/modules/rental-lifecycle/services/rental-lifecycle.coordinator';
import { RoomService } from '../../src/modules/room/services/room.service';
import { TenancyParticipantService } from '../../src/modules/tenancy/services/tenancy-participant.service';
import { TenancyService } from '../../src/modules/tenancy/services/tenancy.service';
import { createActiveProperty, createCoreFoundationHarness } from './support/core-foundation.harness';
import { readRepoFiles } from '../conformance/erd3/support/source';

const context = {
  reasonCode: 'LANDLORD_MANUAL',
  actorType: 'operator',
  trigger: 'manual_command',
};

async function lifecycleFixture() {
  const harness = createCoreFoundationHarness();
  const propertyId = await createActiveProperty(harness);
  const room = await harness.roomService.create({ propertyId, nameOrLabel: '101' });
  const listings = new ListingService();
  const tenancies = new TenancyService();
  const participants = new TenancyParticipantService(tenancies);
  const coordinator = new RentalLifecycleCoordinator(
    harness.roomService,
    harness.propertyService,
    listings,
    tenancies,
    participants,
  );
  return { ...harness, propertyId, room, listings, tenancies, participants, coordinator };
}

async function createListing(fixture: Awaited<ReturnType<typeof lifecycleFixture>>) {
  return fixture.coordinator.createListing({
    roomId: fixture.room.id,
    publicTitle: 'Room 101',
    publicDescription: 'Public description',
    publicPriceProjection: '3500000.00',
    publicLocationProjection: { latitude: 21, longitude: 105 },
  });
}

async function snapshot(
  fixture: Awaited<ReturnType<typeof lifecycleFixture>>,
  listingId?: string,
) {
  return JSON.stringify({
    room: await fixture.roomService.findById(fixture.room.id),
    listing: listingId ? await fixture.listings.findById(listingId) : undefined,
    events: listingId ? await fixture.listings.listStatusEvents(listingId) : [],
    tenancies: await fixture.tenancies.findByRoomId(fixture.room.id),
  });
}

async function addPrimary(
  fixture: Awaited<ReturnType<typeof lifecycleFixture>>,
  tenancyId: string,
) {
  await fixture.participants.add({
    tenancyId,
    userId: 'user_primary',
    role: 'PRIMARY',
    joinedAt: '2026-09-29T00:00:00.000Z',
  });
}

test('creates a Listing only under active Room and Property ancestry', async () => {
  const fixture = await lifecycleFixture();

  const listing = await createListing(fixture);

  assert.equal(listing.status, 'draft');
  assert.equal(listing.roomId, fixture.room.id);
});

test('rejects Listing creation for an archived Room without mutation', async () => {
  const fixture = await lifecycleFixture();
  await fixture.roomService.transitionOperationalState(fixture.room.id, 'inactive', 'manual');
  await fixture.roomService.archive(fixture.room.id, {
    hasNonTerminalTenancy: false,
    hasOpenIncident: false,
  });
  const before = await snapshot(fixture);

  await assert.rejects(createListing(fixture), BadRequestException);

  assert.equal(await snapshot(fixture), before);
});

test('rejects Listing creation for an archived Property without mutation', async () => {
  const fixture = await lifecycleFixture();
  await fixture.propertyService.archive(fixture.propertyId, {
    hasNonTerminalTenancy: false,
    hasPublishedListing: false,
    hasOccupiedRoom: false,
    hasNonInactiveOrArchivedRoom: false,
    hasOpenIncident: false,
  });
  const before = await snapshot(fixture);

  await assert.rejects(createListing(fixture), BadRequestException);

  assert.equal(await snapshot(fixture), before);
});

test('publishes an eligible draft Listing', async () => {
  const fixture = await lifecycleFixture();
  const listing = await createListing(fixture);

  const published = await fixture.coordinator.publishListing(listing.id, context);

  assert.equal(published.status, 'published');
  assert.deepEqual(
    (await fixture.listings.listStatusEvents(listing.id)).map(
      ({ fromStatus, toStatus, reasonCode }) => ({ fromStatus, toStatus, reasonCode }),
    ),
    [{ fromStatus: 'draft', toStatus: 'published', reasonCode: 'LANDLORD_MANUAL' }],
  );
});

for (const nextState of ['maintenance', 'inactive'] as const) {
  test(`publish rejects a ${nextState} Room without Listing/event mutation`, async () => {
    const fixture = await lifecycleFixture();
    const listing = await createListing(fixture);
    await fixture.roomService.transitionOperationalState(fixture.room.id, nextState, 'manual');
    const before = await snapshot(fixture, listing.id);

    await assert.rejects(fixture.coordinator.publishListing(listing.id, context), BadRequestException);

    assert.equal(await snapshot(fixture, listing.id), before);
  });
}

test('publish rejects an occupied Room without Listing/event mutation', async () => {
  const fixture = await lifecycleFixture();
  const listing = await createListing(fixture);
  await fixture.roomService.transitionOperationalState(fixture.room.id, 'occupied', 'tenancy_activated');
  const before = await snapshot(fixture, listing.id);

  await assert.rejects(fixture.coordinator.publishListing(listing.id, context), BadRequestException);

  assert.equal(await snapshot(fixture, listing.id), before);
});

test('publish rejects archived Room or Property ancestry without Listing/event mutation', async () => {
  for (const archive of ['room', 'property'] as const) {
    const fixture = await lifecycleFixture();
    const listing = await createListing(fixture);
    if (archive === 'room') {
      await fixture.roomService.transitionOperationalState(fixture.room.id, 'inactive', 'manual');
      await fixture.roomService.archive(fixture.room.id, {
        hasNonTerminalTenancy: false,
        hasOpenIncident: false,
      });
    } else {
      await fixture.propertyService.archive(fixture.propertyId, {
        hasNonTerminalTenancy: false,
        hasPublishedListing: false,
        hasOccupiedRoom: false,
        hasNonInactiveOrArchivedRoom: false,
        hasOpenIncident: false,
      });
    }
    const before = await snapshot(fixture, listing.id);

    await assert.rejects(fixture.coordinator.publishListing(listing.id, context), BadRequestException);

    assert.equal(await snapshot(fixture, listing.id), before);
  }
});

for (const [nextState, reasonCode] of [
  ['maintenance', 'ROOM_MAINTENANCE'],
  ['inactive', 'ROOM_INACTIVE'],
] as const) {
  test(`VACANT -> ${nextState} unpublishes the current Listing synchronously`, async () => {
    const fixture = await lifecycleFixture();
    const listing = await createListing(fixture);
    await fixture.coordinator.publishListing(listing.id, context);

    const room = await fixture.coordinator.transitionRoomManually(
      fixture.room.id,
      nextState,
      context,
    );

    assert.equal(room.operationalState, nextState);
    assert.equal((await fixture.listings.findById(listing.id)).status, 'unpublished');
    assert.equal((await fixture.listings.listStatusEvents(listing.id)).at(-1)?.reasonCode, reasonCode);
  });
}

test('the public Room operational-state route is owned by RentalLifecycleController', () => {
  const roomController = readRepoFiles(['src/modules/room/controllers/room.controller.ts']);
  const lifecycleController = readRepoFiles([
    'src/modules/rental-lifecycle/controllers/rental-lifecycle.controller.ts',
  ]);

  assert.doesNotMatch(roomController, /operational-state/);
  assert.match(lifecycleController, /@Patch\('rooms\/:id\/operational-state'\)/);
  assert.match(lifecycleController, /transitionRoomManually/);
});

test('creates a Tenancy under active ancestry even when the Room is not vacant', async () => {
  const fixture = await lifecycleFixture();
  await fixture.roomService.transitionOperationalState(fixture.room.id, 'maintenance', 'manual');

  const tenancy = await fixture.coordinator.createTenancy(fixture.room.id);

  assert.equal(tenancy.status, 'draft');
});

test('rejects Tenancy creation for archived Room or Property ancestry without mutation', async () => {
  for (const archive of ['room', 'property'] as const) {
    const fixture = await lifecycleFixture();
    if (archive === 'room') {
      await fixture.roomService.transitionOperationalState(fixture.room.id, 'inactive', 'manual');
      await fixture.roomService.archive(fixture.room.id, {
        hasNonTerminalTenancy: false,
        hasOpenIncident: false,
      });
    } else {
      await fixture.propertyService.archive(fixture.propertyId, {
        hasNonTerminalTenancy: false,
        hasPublishedListing: false,
        hasOccupiedRoom: false,
        hasNonInactiveOrArchivedRoom: false,
        hasOpenIncident: false,
      });
    }
    const before = await snapshot(fixture);

    await assert.rejects(fixture.coordinator.createTenancy(fixture.room.id), BadRequestException);

    assert.equal(await snapshot(fixture), before);
  }
});

test('an ENDING Tenancy blocks the next draft Tenancy', async () => {
  const fixture = await lifecycleFixture();
  const tenancy = await fixture.coordinator.createTenancy(fixture.room.id);
  await addPrimary(fixture, tenancy.id);
  await fixture.coordinator.activateTenancy(tenancy.id, context, '2026-09-29T00:00:00.000Z');
  await fixture.tenancies.startEnding(tenancy.id);
  const before = await snapshot(fixture);

  await assert.rejects(fixture.coordinator.createTenancy(fixture.room.id), BadRequestException);

  assert.equal(await snapshot(fixture), before);
});

test('activation requires exactly one active PRIMARY without partial mutation', async () => {
  const fixture = await lifecycleFixture();
  const listing = await createListing(fixture);
  await fixture.coordinator.publishListing(listing.id, context);
  const tenancy = await fixture.coordinator.createTenancy(fixture.room.id);
  const before = await snapshot(fixture, listing.id);

  await assert.rejects(
    fixture.coordinator.activateTenancy(tenancy.id, context, '2026-09-29T00:00:00.000Z'),
    BadRequestException,
  );

  assert.equal(await snapshot(fixture, listing.id), before);
});

test('activation rejects a non-vacant Room without partial mutation', async () => {
  const fixture = await lifecycleFixture();
  const listing = await createListing(fixture);
  await fixture.coordinator.publishListing(listing.id, context);
  const tenancy = await fixture.coordinator.createTenancy(fixture.room.id);
  await addPrimary(fixture, tenancy.id);
  await fixture.roomService.transitionOperationalState(fixture.room.id, 'occupied', 'tenancy_activated');
  const before = await snapshot(fixture, listing.id);

  await assert.rejects(
    fixture.coordinator.activateTenancy(tenancy.id, context, '2026-09-29T00:00:00.000Z'),
    BadRequestException,
  );

  assert.equal(await snapshot(fixture, listing.id), before);
});

test('activation unpublishes Listing then activates Tenancy and occupies Room', async () => {
  const fixture = await lifecycleFixture();
  const listing = await createListing(fixture);
  await fixture.coordinator.publishListing(listing.id, context);
  const tenancy = await fixture.coordinator.createTenancy(fixture.room.id);
  await addPrimary(fixture, tenancy.id);

  const activated = await fixture.coordinator.activateTenancy(
    tenancy.id,
    context,
    '2026-09-29T00:00:00.000Z',
  );

  assert.equal(activated.status, 'active');
  assert.equal((await fixture.roomService.findById(fixture.room.id)).operationalState, 'occupied');
  assert.equal((await fixture.listings.findById(listing.id)).status, 'unpublished');
  assert.equal((await fixture.listings.listStatusEvents(listing.id)).at(-1)?.reasonCode, 'ROOM_OCCUPIED');
});

test('checkout requires ENDING with its matching occupied Room and does not mutate on rejection', async () => {
  const fixture = await lifecycleFixture();
  const tenancy = await fixture.coordinator.createTenancy(fixture.room.id);
  await addPrimary(fixture, tenancy.id);
  await fixture.coordinator.activateTenancy(tenancy.id, context, '2026-09-29T00:00:00.000Z');
  const before = await snapshot(fixture);

  await assert.rejects(
    fixture.coordinator.checkoutTenancy(tenancy.id, 'TERM_ENDED', '2026-09-30T00:00:00.000Z'),
    BadRequestException,
  );

  assert.equal(await snapshot(fixture), before);
});

test('checkout rejects an invalid neutral end reason without partial mutation', async () => {
  const fixture = await lifecycleFixture();
  const tenancy = await fixture.coordinator.createTenancy(fixture.room.id);
  await addPrimary(fixture, tenancy.id);
  await fixture.coordinator.activateTenancy(tenancy.id, context, '2026-09-29T00:00:00.000Z');
  await fixture.tenancies.startEnding(tenancy.id);
  const before = await snapshot(fixture);

  await assert.rejects(
    fixture.coordinator.checkoutTenancy(
      tenancy.id,
      'NOT_A_NEUTRAL_REASON' as never,
      '2026-09-30T00:00:00.000Z',
    ),
    BadRequestException,
  );

  assert.equal(await snapshot(fixture), before);
});

test('checkout ends an ENDING Tenancy, vacates the Room, and does not republish Listing', async () => {
  const fixture = await lifecycleFixture();
  const listing = await createListing(fixture);
  await fixture.coordinator.publishListing(listing.id, context);
  const tenancy = await fixture.coordinator.createTenancy(fixture.room.id);
  await addPrimary(fixture, tenancy.id);
  await fixture.coordinator.activateTenancy(tenancy.id, context, '2026-09-29T00:00:00.000Z');
  await fixture.tenancies.startEnding(tenancy.id);

  const ended = await fixture.coordinator.checkoutTenancy(
    tenancy.id,
    'TERM_ENDED',
    '2026-09-30T00:00:00.000Z',
  );

  assert.deepEqual(
    { status: ended.status, endedAt: ended.endedAt, endReason: ended.endReason },
    { status: 'ended', endedAt: '2026-09-30T00:00:00.000Z', endReason: 'TERM_ENDED' },
  );
  assert.equal((await fixture.roomService.findById(fixture.room.id)).operationalState, 'vacant');
  assert.equal((await fixture.listings.findById(listing.id)).status, 'unpublished');
});

test('archiveAllForRoom archives a legal local Listing without inventing a published shortcut', async () => {
  const fixture = await lifecycleFixture();
  const listing = await createListing(fixture);

  const archived = await fixture.listings.archiveAllForRoom(fixture.room.id, () => ({
    ...context,
    reasonCode: 'PROPERTY_CORRECTION',
  }));

  assert.equal(archived[0]?.status, 'archived');
});
