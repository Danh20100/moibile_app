import assert from 'node:assert/strict';
import test from 'node:test';
import {
  RentalGuardViolation,
  RentalTransactionCoordinator,
} from '../../../../src/persistence/guards/rental-transaction-coordinator';
import { PostgresIncidentRepository } from '../../../../src/infrastructure/database/repositories/incident.repository';
import { rentalPersistenceFixture as data } from '../../../support/rental-fixtures';
import { rentalFixture } from './rental-test-support';

test('rental guards enforce publish activation checkout and archive rules', async () => {
  const url = process.env.TEST_DATABASE_URL;
  assert.ok(url);
  const f = await rentalFixture(url),
    c = new RentalTransactionCoordinator(f.manager),
    expected = data.expected;
  try {
    await c.publishListing(f.ids.listing);
    assert.equal((await f.listings.findListing(f.ids.listing))?.status, expected.published);
    await c.createTenancy({ ...data.tenancy });
    await f.tenancies.insertParticipant({ ...data.participant });
    await c.activateTenancy(f.ids.tenancy);
    assert.equal((await f.p.findRoom(f.ids.room))?.operationalState, expected.occupied);
    assert.equal((await f.listings.findListing(f.ids.listing))?.status, expected.unpublished);
    const t = await f.tenancies.findTenancy(f.ids.tenancy);
    assert.ok(t);
    assert.equal(t.startedAt, data.tenancy.startedAt);
    t.status = expected.ending;
    await f.tenancies.updateTenancy(t);
    await c.checkoutTenancy(f.ids.tenancy, data.checkout.endReason, data.checkout.endedAt);
    const ended = await f.tenancies.findTenancy(f.ids.tenancy);
    assert.ok(ended);
    assert.equal(ended.status, expected.ended);
    assert.equal(ended.startedAt, data.tenancy.startedAt);
    assert.equal(ended.endedAt, data.checkout.endedAt);
    assert.equal(ended.endReason, data.checkout.endReason);
    assert.equal((await f.p.findRoom(f.ids.room))?.operationalState, expected.vacant);
    const room = await f.p.findRoom(f.ids.room);
    assert.ok(room);
    room.operationalState = expected.inactive;
    await f.p.updateRoom(room);
    const incidents = new PostgresIncidentRepository(f.db);
    await incidents.createIncident({ ...data.incident });
    await assert.rejects(
      c.archiveRoom(f.ids.room),
      (error: unknown) =>
        error instanceof RentalGuardViolation && error.guard === expected.archiveBlocker,
    );
    const incident = await incidents.findIncident(data.incident.incidentId);
    assert.ok(incident);
    await incidents.updateIncident({ ...incident, ...data.incidentClosure });
    await assert.rejects(
      c.archiveRoom(f.ids.room),
      (error: unknown) =>
        error instanceof RentalGuardViolation && error.guard === expected.archiveBlocker,
    );
    assert.equal((await f.p.findRoom(f.ids.room))?.recordLifecycle, 'ACTIVE');
    assert.equal((await f.p.findRoom(f.ids.room))?.operationalState, expected.inactive);
    assert.equal((await f.listings.findListing(f.ids.listing))?.status, expected.unpublished);

    const eligibleRoomId = '40000000-0000-4000-8000-000000000002';
    const eligibleListingId = '50000000-0000-4000-8000-000000000002';
    await f.p.createRoom({ ...data.room, roomId: eligibleRoomId, nameOrLabel: 'R2' });
    await f.listings.createListing({ ...data.listing, listingId: eligibleListingId, roomId: eligibleRoomId });
    await c.publishListing(eligibleListingId);
    await c.archiveRoom(eligibleRoomId);
    assert.equal((await f.p.findRoom(eligibleRoomId))?.recordLifecycle, expected.archived);
    assert.equal((await f.listings.findListing(eligibleListingId))?.status, expected.archived);
  } finally {
    await f.db.destroy();
  }
});

test('checkout before tenancy start rolls back tenancy room and listing atomically', async () => {
  const url = process.env.TEST_DATABASE_URL;
  assert.ok(url);
  const f = await rentalFixture(url),
    c = new RentalTransactionCoordinator(f.manager);
  try {
    await c.publishListing(f.ids.listing);
    await c.createTenancy({ ...data.tenancy });
    await f.tenancies.insertParticipant({ ...data.participant });
    await c.activateTenancy(f.ids.tenancy);
    const t = await f.tenancies.findTenancy(f.ids.tenancy);
    assert.ok(t);
    await f.tenancies.updateTenancy({ ...t, status: data.expected.ending });
    const snapshot = async () => ({
      tenancy: await f.tenancies.findTenancy(f.ids.tenancy),
      room: await f.p.findRoom(f.ids.room),
      listing: await f.listings.findListing(f.ids.listing),
    });
    const before = await snapshot();
    await assert.rejects(
      c.checkoutTenancy(f.ids.tenancy, data.checkout.endReason, data.checkout.invalidEndedAt),
      { name: data.expected.timeOrderError },
    );
    assert.deepEqual(await snapshot(), before);
    assert.equal(before.tenancy?.status, data.expected.ending);
    assert.equal(before.room?.operationalState, data.expected.occupied);
    assert.equal(before.listing?.status, data.expected.unpublished);
  } finally {
    await f.db.destroy();
  }
});
