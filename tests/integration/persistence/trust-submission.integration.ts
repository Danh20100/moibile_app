import assert from 'node:assert/strict';
import test from 'node:test';
import { AuditTrustService } from '../../../src/modules/audit-trust/services/audit-trust.service';
import { PostgresListingRepository } from '../../../src/infrastructure/database/repositories/listing.repository';
import { rentalFixture } from './guards/rental-test-support';

test('listing lock serializes unpublish against report insert', async () => {
  const url = process.env.TEST_DATABASE_URL;
  assert.ok(url);
  const fixture = await rentalFixture(url);
  const listings = new PostgresListingRepository(fixture.db);
  const current = await listings.findListing(fixture.ids.listing);
  assert.ok(current);
  await listings.updateListing({ ...current, status: 'PUBLISHED' });
  const service = new AuditTrustService(fixture.manager);
  try {
    let locked = false;
    let release!: () => void;
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    const holder = fixture.manager.run(async ({ repositories }) => {
      await repositories.listing.lockListing(fixture.ids.listing);
      locked = true;
      await hold;
      const row = await repositories.listing.findListing(fixture.ids.listing);
      assert.ok(row);
      await repositories.listing.updateListing({ ...row, status: 'UNPUBLISHED' });
    });
    while (!locked) await new Promise((resolve) => setTimeout(resolve, 10));
    const report = service.submitReport(
      { listingId: fixture.ids.listing, reason: 'SPAM' },
      fixture.ids.user,
    );
    release();
    await holder;
    await assert.rejects(report);
    const stored = await fixture.manager.run(({ repositories }) => repositories.trust.findTrustReports());
    assert.equal(stored.length, 0);
    const unpublished = await listings.findListing(fixture.ids.listing);
    assert.equal(unpublished?.status, 'UNPUBLISHED');
  } finally {
    await fixture.db.destroy();
  }
});

test('report stores principal and published target after lock', async () => {
  const url = process.env.TEST_DATABASE_URL;
  assert.ok(url);
  const fixture = await rentalFixture(url);
  const listings = new PostgresListingRepository(fixture.db);
  const current = await listings.findListing(fixture.ids.listing);
  assert.ok(current);
  await listings.updateListing({ ...current, status: 'PUBLISHED' });
  const service = new AuditTrustService(fixture.manager);
  try {
    const created = await service.submitReport(
      { listingId: fixture.ids.listing, reason: 'WRONG_LOCATION', note: 'sai vị trí' },
      fixture.ids.user,
    );
    assert.equal(created.reporterUserId, fixture.ids.user);
    assert.equal(created.listingId, fixture.ids.listing);
    assert.equal(created.status, 'SUBMITTED');
    const stored = await fixture.manager.run(({ repositories }) => repositories.trust.findTrustReports());
    assert.equal(stored.length, 1);
    assert.equal(stored[0]?.reporterUserId, fixture.ids.user);
    assert.equal(stored[0]?.listingId, fixture.ids.listing);
    const listing = await listings.findListing(fixture.ids.listing);
    assert.equal(listing?.status, 'PUBLISHED');
  } finally {
    await fixture.db.destroy();
  }
});
