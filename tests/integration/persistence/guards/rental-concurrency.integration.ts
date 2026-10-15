import assert from 'node:assert/strict';
import test from 'node:test';
import {
  RentalGuardViolation,
  RentalTransactionCoordinator,
} from '../../../../src/persistence/guards/rental-transaction-coordinator';
import { rentalPersistenceFixture as data } from '../../../support/rental-fixtures';
import { rentalFixture } from './rental-test-support';

function inspectOutcomes(outcomes: PromiseSettledResult<void>[], allowedGuards: string[]) {
  assert.equal(outcomes.filter((x) => x.status === 'fulfilled').length, data.expected.singleCommit);
  assert.equal(
    outcomes.filter((x) => x.status === 'rejected').length,
    data.expected.singleRejection,
  );
  for (const outcome of outcomes) {
    if (outcome.status === 'rejected') {
      assert.ok(outcome.reason instanceof RentalGuardViolation);
      assert.ok(allowedGuards.includes(outcome.reason.guard));
    }
  }
}

test('concurrent tenancy creation admits at most one nonterminal tenancy', async () => {
  const url = process.env.TEST_DATABASE_URL;
  assert.ok(url);
  const f = await rentalFixture(url),
    c = new RentalTransactionCoordinator(f.manager);
  try {
    const make = (tenancyId: string) => c.createTenancy({ ...data.tenancy, tenancyId });
    const outcomes = await Promise.allSettled([make(f.ids.tenancy), make(data.secondTenancyId)]);
    inspectOutcomes(outcomes, [data.expected.activationGuard]);
    const stored = await f.tenancies.findNonterminalByRoom(f.ids.room);
    assert.equal(stored.length, data.expected.singleCommit);
    const winner = outcomes.findIndex((x) => x.status === 'fulfilled');
    assert.equal(stored[0]?.tenancyId, [f.ids.tenancy, data.secondTenancyId][winner]);
    assert.equal(
      await f.tenancies.findTenancy([data.secondTenancyId, f.ids.tenancy][winner]),
      undefined,
    );
  } finally {
    await f.db.destroy();
  }
});

test('publish racing with leaving VACANT never leaves a published unavailable room', async () => {
  const url = process.env.TEST_DATABASE_URL;
  assert.ok(url);
  const f = await rentalFixture(url),
    c = new RentalTransactionCoordinator(f.manager);
  try {
    const outcomes = await Promise.allSettled([
      c.publishListing(f.ids.listing),
      c.changeRoomOperationalState(f.ids.room, data.expected.maintenance),
    ]);
    assert.equal(outcomes[1].status, 'fulfilled');
    if (outcomes[0].status === 'rejected') {
      assert.ok(outcomes[0].reason instanceof RentalGuardViolation);
      assert.equal(outcomes[0].reason.guard, data.expected.publishGuard);
    }
    const room = await f.p.findRoom(f.ids.room),
      listing = await f.listings.findListing(f.ids.listing);
    assert.ok(room && listing);
    assert.equal(room.operationalState, data.expected.maintenance);
    assert.equal(
      listing.status,
      outcomes[0].status === 'fulfilled' ? data.expected.unpublished : data.listing.status,
    );
  } finally {
    await f.db.destroy();
  }
});

test('checkout racing with another room transition preserves tenancy-room coherence', async () => {
  const url = process.env.TEST_DATABASE_URL;
  assert.ok(url);
  const f = await rentalFixture(url),
    c = new RentalTransactionCoordinator(f.manager);
  try {
    await c.createTenancy({ ...data.tenancy });
    await f.tenancies.insertParticipant({ ...data.participant });
    await c.activateTenancy(f.ids.tenancy);
    const t = await f.tenancies.findTenancy(f.ids.tenancy);
    assert.ok(t);
    await f.tenancies.updateTenancy({ ...t, status: data.expected.ending });
    const outcomes = await Promise.allSettled([
      c.checkoutTenancy(f.ids.tenancy, data.checkout.endReason, data.checkout.endedAt),
      c.changeRoomOperationalState(f.ids.room, data.expected.vacant),
    ]);
    inspectOutcomes(outcomes, [data.expected.transitionGuard]);
    assert.equal(outcomes[0].status, 'fulfilled');
    const ended = await f.tenancies.findTenancy(f.ids.tenancy);
    assert.ok(ended);
    assert.equal(ended.status, data.expected.ended);
    assert.equal(ended.startedAt, data.tenancy.startedAt);
    assert.equal(ended.endedAt, data.checkout.endedAt);
    assert.equal(ended.endReason, data.checkout.endReason);
    assert.equal((await f.p.findRoom(f.ids.room))?.operationalState, data.expected.vacant);
  } finally {
    await f.db.destroy();
  }
});

test('property archive racing with child reactivation cannot reactivate under archived parent', async () => {
  const url = process.env.TEST_DATABASE_URL;
  assert.ok(url);
  const f = await rentalFixture(url),
    c = new RentalTransactionCoordinator(f.manager);
  try {
    const room = await f.p.findRoom(f.ids.room);
    assert.ok(room);
    await f.p.updateRoom({ ...room, operationalState: data.expected.inactive });
    const outcomes = await Promise.allSettled([
      c.archiveProperty(f.ids.property),
      c.changeRoomOperationalState(f.ids.room, data.expected.vacant),
    ]);
    inspectOutcomes(outcomes, [data.expected.archiveGuard, data.expected.transitionGuard]);
    const property = await f.p.findProperty(f.ids.property),
      fresh = await f.p.findRoom(f.ids.room);
    assert.ok(property && fresh);
    assert.equal(
      property.lifecycleStatus,
      outcomes[0].status === 'fulfilled' ? data.expected.archived : data.property.lifecycleStatus,
    );
    assert.equal(
      fresh.operationalState,
      outcomes[0].status === 'fulfilled' ? data.expected.inactive : data.expected.vacant,
    );
  } finally {
    await f.db.destroy();
  }
});
