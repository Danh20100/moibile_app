import assert from 'node:assert/strict';
import test from 'node:test';

import { createDatabaseClient } from '../../../src/infrastructure/database/database.client';
import { PostgresTransactionManager } from '../../../src/infrastructure/database/postgres-transaction-manager';
import { createRepositorySet } from '../../../src/infrastructure/database/repositories/repository-set';
import { OrganizationService } from '../../../src/modules/organization/services/organization.service';
import { PropertyService } from '../../../src/modules/property/services/property.service';
import { RoomService } from '../../../src/modules/room/services/room.service';
import { ListingService } from '../../../src/modules/listing/services/listing.service';
import { InquiryService } from '../../../src/modules/listing/services/inquiry.service';
import { runMigrations } from '../../../scripts/database/migrate';
import { resetPublicSchema } from './support/postgres-test-harness';

function runtime(databaseUrl: string) {
  const database = createDatabaseClient({ url: databaseUrl, maxPoolSize: 4, connectionTimeoutMs: 5000 });
  const transactions = new PostgresTransactionManager(database, createRepositorySet);
  const organizations = new OrganizationService(transactions);
  const properties = new PropertyService(organizations, transactions);
  const rooms = new RoomService(properties, transactions);
  const listings = new ListingService(transactions);
  const inquiries = new InquiryService(listings, transactions);
  return { database, transactions, organizations, properties, rooms, listings, inquiries };
}

test('core application state remains readable after database client restart', async () => {
  const databaseUrl = process.env.TEST_DATABASE_URL;
  assert.ok(databaseUrl, 'TEST_DATABASE_URL is required');
  await resetPublicSchema(databaseUrl);
  await runMigrations('up', databaseUrl);

  const first = runtime(databaseUrl);
  const ownerId = '10000000-0000-4000-8000-000000000099';
  await first.transactions.run(({ repositories }) => repositories.identity.ensureUser(ownerId));
  const organization = await first.organizations.create({ name: 'Restart Workspace', primaryOwnerUserId: ownerId });
  const property = await first.properties.create({ organizationId: organization.id, name: 'Restart Property', operationalAddressText: 'Private address', operationalLocation: { longitude: 106.7, latitude: 10.7 }, publicLocationProjection: { longitude: 106.701, latitude: 10.701 } });
  const room = await first.rooms.create({ propertyId: property.id, nameOrLabel: 'A-01' });
  const listing = await first.listings.createDraft({ roomId: room.id, publicTitle: 'Restart Listing', publicDescription: 'Persisted public content', publicPriceProjection: '3500000.00', publicLocationProjection: { longitude: 106.701, latitude: 10.701 } });
  const inquiry = await first.inquiries.create({ listingId: listing.id, contactIntentOrMessage: 'Interested', status: 'NEW' });
  await first.database.destroy();

  const second = runtime(databaseUrl);
  try {
    assert.deepEqual(await second.organizations.findById(organization.id), organization);
    assert.deepEqual(await second.properties.findById(property.id), property);
    assert.deepEqual(await second.rooms.findById(room.id), room);
    assert.deepEqual(await second.listings.findById(listing.id), listing);
    assert.deepEqual(await second.inquiries.findById(inquiry.id), inquiry);
  } finally { await second.database.destroy(); }
});
