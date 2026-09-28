import assert from 'node:assert/strict';
import test from 'node:test';

import { runMigrations } from '../../../scripts/database/migrate';
import { createDatabaseClient } from '../../../src/infrastructure/database/database.client';
import { PostgresIdentityRepository } from '../../../src/infrastructure/database/repositories/identity.repository';
import { PostgresListingRepository } from '../../../src/infrastructure/database/repositories/listing.repository';
import { PostgresOrganizationRepository } from '../../../src/infrastructure/database/repositories/organization.repository';
import { PostgresPropertyRepository } from '../../../src/infrastructure/database/repositories/property.repository';
import {
  PersistenceForeignKeyViolation,
  PersistenceUniqueViolation,
} from '../../../src/persistence/errors';
import { resetPublicSchema } from './support/postgres-test-harness';

test('core rental adapters persist and read exact values', async () => {
  const databaseUrl = process.env.TEST_DATABASE_URL;
  assert.ok(databaseUrl, 'TEST_DATABASE_URL is required');
  await resetPublicSchema(databaseUrl);
  await runMigrations('up', databaseUrl);
  const database = createDatabaseClient({ url: databaseUrl, maxPoolSize: 4, connectionTimeoutMs: 5000 });
  const identity = new PostgresIdentityRepository(database);
  const organization = new PostgresOrganizationRepository(database);
  const property = new PostgresPropertyRepository(database);
  const listing = new PostgresListingRepository(database);
  try {
    const userId = '10000000-0000-4000-8000-000000000001';
    const organizationId = '20000000-0000-4000-8000-000000000001';
    const propertyId = '30000000-0000-4000-8000-000000000001';
    const roomId = '40000000-0000-4000-8000-000000000001';
    const listingId = '50000000-0000-4000-8000-000000000001';
    await identity.insertUser(userId);
    await organization.createOrganization({ organizationId, primaryOwnerUserId: userId, name: 'Exact organization' });
    await property.createProperty({
      propertyId, organizationId, name: 'Exact property', lifecycleStatus: 'ACTIVE',
      operationalAddressText: 'Private address', operationalLocation: { longitude: 106.7001, latitude: 10.7751 },
      publicLocationProjection: { longitude: 106.7, latitude: 10.775 },
    });
    await property.createRoom({ roomId, propertyId, nameOrLabel: 'A-01', operationalState: 'VACANT', recordLifecycle: 'ACTIVE' });
    await listing.createListing({
      listingId, roomId, status: 'DRAFT', publicTitle: 'Room title', publicDescription: 'Room description',
      publicPriceProjection: '9999999999999999.99', publicLocationProjection: { longitude: 106.7, latitude: 10.775 },
    });
    await listing.insertStatusEvent({
      listingStatusEventId: '60000000-0000-4000-8000-000000000001', listingId,
      fromStatus: 'DRAFT', toStatus: 'DRAFT', reasonCode: 'CREATED', actorType: 'SYSTEM',
      actorUserId: null, trigger: 'CREATE', occurredAt: '2026-09-28T07:15:16.000Z', metadata: null,
    });
    await listing.createInquiry({
      inquiryId: '70000000-0000-4000-8000-000000000001', listingId, senderUserId: null,
      contactIntentOrMessage: 'Contact request', status: 'OPEN', createdAt: '2026-09-28T07:15:17.000Z',
    });

    assert.equal(await identity.userExists(userId), true);
    assert.deepEqual(await organization.findOrganization(organizationId), { organizationId, primaryOwnerUserId: userId, name: 'Exact organization' });
    assert.deepEqual(await property.findRoom(roomId), { roomId, propertyId, nameOrLabel: 'A-01', operationalState: 'VACANT', recordLifecycle: 'ACTIVE' });
    assert.deepEqual(await listing.findListing(listingId), {
      listingId, roomId, status: 'DRAFT', publicTitle: 'Room title', publicDescription: 'Room description',
      publicPriceProjection: '9999999999999999.99', publicLocationProjection: { longitude: 106.7, latitude: 10.775 },
    });
    assert.deepEqual(await listing.findInquiry('70000000-0000-4000-8000-000000000001'), {
      inquiryId: '70000000-0000-4000-8000-000000000001', listingId, senderUserId: null,
      contactIntentOrMessage: 'Contact request', status: 'OPEN', createdAt: '2026-09-28T07:15:17.000Z',
    });
    const persistedProperty = await property.findProperty(propertyId);
    assert.deepEqual(persistedProperty?.operationalLocation, { longitude: 106.7001, latitude: 10.7751 });
    assert.deepEqual(persistedProperty?.publicLocationProjection, { longitude: 106.7, latitude: 10.775 });
    const statusEvent = await database.selectFrom('listing_status_events')
      .select(['actor_user_id', 'metadata', 'occurred_at'])
      .where('listing_status_event_id', '=', '60000000-0000-4000-8000-000000000001')
      .executeTakeFirstOrThrow();
    assert.deepEqual(statusEvent, {
      actor_user_id: null, metadata: null, occurred_at: '2026-09-28T07:15:16.000Z',
    });

    await assert.rejects(
      listing.createListing({
        listingId: '50000000-0000-4000-8000-000000000002', roomId, status: 'DRAFT',
        publicTitle: 'Second', publicDescription: 'Second', publicPriceProjection: '1.00',
        publicLocationProjection: { longitude: 106.7, latitude: 10.775 },
      }),
      PersistenceUniqueViolation,
    );
    await assert.rejects(
      property.createRoom({
        roomId: '40000000-0000-4000-8000-000000000002',
        propertyId: '30000000-0000-4000-8000-000000000099', nameOrLabel: 'Invalid',
        operationalState: 'VACANT', recordLifecycle: 'ACTIVE',
      }),
      PersistenceForeignKeyViolation,
    );
  } finally {
    await database.destroy();
  }
});
