import assert from 'node:assert/strict';
import test from 'node:test';
import { IncidentService } from '../../src/modules/incident/services/incident.service';
import { AuditTrustService } from '../../src/modules/audit-trust/services/audit-trust.service';
import { createCoreTestTransactionManager } from './support/in-memory-transaction-manager';

const roomLookup = { findById: async (id: string) => ({ id }) };

test('Incident follows frozen lifecycle and appends immutable status events', async () => {
  const service = new IncidentService(roomLookup as never, createCoreTestTransactionManager());
  const incident = await service.create({ roomId: 'room-1', reportedByUserId: 'user-1', category: 'PLUMBING' });
  await service.updateStatus(incident.id, { status: 'ACKNOWLEDGED', actorUserId: 'user-2' });
  await service.updateStatus(incident.id, { status: 'IN_PROGRESS', actorUserId: 'user-2' });
  await service.updateStatus(incident.id, { status: 'RESOLVED', actorUserId: 'user-2' });
  await service.updateStatus(incident.id, { status: 'IN_PROGRESS', actorUserId: 'user-2', note: 'Reopened' });
  assert.deepEqual((await service.listEvents(incident.id)).map((event) => event.toStatus), ['REPORTED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'IN_PROGRESS']);
});

test('REJECTED and CLOSED incidents are terminal', async () => {
  const service = new IncidentService(roomLookup as never, createCoreTestTransactionManager());
  const rejected = await service.create({ roomId: 'room-1', category: 'OTHER' });
  await service.updateStatus(rejected.id, { status: 'REJECTED' });
  await assert.rejects(() => service.updateStatus(rejected.id, { status: 'ACKNOWLEDGED' }));
  const closed = await service.create({ roomId: 'room-1', category: 'ELECTRICAL' });
  for (const status of ['ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const) await service.updateStatus(closed.id, { status });
  await assert.rejects(() => service.updateStatus(closed.id, { status: 'IN_PROGRESS' }));
});

test('TrustReport targets exactly one published Listing without auto-removal policy', async () => {
  const tx = createCoreTestTransactionManager();
  await tx.run(({ repositories }) =>
    repositories.listing.createListing({
      listingId: 'listing-1',
      roomId: 'room-1',
      status: 'PUBLISHED',
      publicTitle: 'T',
      publicDescription: 'D',
      publicPriceProjection: '1.00',
      publicLocationProjection: { longitude: 106.7, latitude: 10.8 },
    }),
  );
  const service = new AuditTrustService(tx);
  const listing = await service.submitReport({ listingId: 'listing-1', reason: 'INCORRECT_INFORMATION' }, 'user-1');
  assert.equal(listing.listingId, 'listing-1');
  assert.equal(listing.reporterUserId, 'user-1');
  assert.equal(listing.status, 'SUBMITTED');
  await assert.rejects(() => service.submitReport({ listingId: 'listing-1', reviewId: 'review-1', reason: 'SPAM' }, 'user-1'));
  await assert.rejects(() => service.submitReport({ reason: 'OTHER' }, 'user-1'));
  await assert.rejects(() => service.submitReport({ reviewId: 'review-1', reason: 'SPAM' }, 'user-1'));
  await assert.rejects(() => service.listReports());
});
