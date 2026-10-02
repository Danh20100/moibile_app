import { createDatabaseClient } from '../../../src/infrastructure/database/database.client';
import { loadDatabaseConfig } from '../../../src/infrastructure/database/database.config';
import { PostgresTransactionManager } from '../../../src/infrastructure/database/postgres-transaction-manager';
import { createRepositorySet } from '../../../src/infrastructure/database/repositories/repository-set';
import type { TransactionContext } from '../../../src/persistence/ports/transaction-manager';
import { DISCOVERY_FIXTURE as fixture } from '../fixtures/discovery';
import { assertSafeE2eDatabaseUrl } from './database';

export async function seedDiscoveryFixture(context: TransactionContext): Promise<void> {
  const repositories = context.repositories;
  const { ids } = fixture;

  await repositories.identity.ensureUser(ids.operatorUserId);

  const organization = await repositories.organization.findOrganization(ids.organizationId);
  if (!organization) {
    await repositories.organization.createOrganization({
      organizationId: ids.organizationId,
      primaryOwnerUserId: ids.operatorUserId,
      name: fixture.organizationName,
    });
  } else if (organization.primaryOwnerUserId !== ids.operatorUserId) {
    throw new Error('E2E organization ID collision with a different owner');
  }
  const property = await repositories.property.findProperty(ids.propertyId);
  if (!property) {
    await repositories.property.createProperty({
      propertyId: ids.propertyId,
      organizationId: ids.organizationId,
      name: fixture.propertyName,
      lifecycleStatus: 'ACTIVE',
      operationalAddressText: fixture.operationalAddressText,
      operationalLocation: fixture.operationalLocation,
      publicLocationProjection: fixture.publicLocationProjection,
    });
  } else if (property.organizationId !== ids.organizationId) {
    throw new Error('E2E property ID collision with a different organization');
  }

  const room = await repositories.property.findRoom(ids.roomId);
  if (!room) {
    await repositories.property.createRoom({
      roomId: ids.roomId,
      propertyId: ids.propertyId,
      nameOrLabel: fixture.roomNameOrLabel,
      operationalState: 'VACANT',
      recordLifecycle: 'ACTIVE',
    });
  } else if (room.propertyId !== ids.propertyId) {
    throw new Error('E2E room ID collision with a different property');
  }
  const currentListing = await repositories.listing.findCurrentListingByRoom(ids.roomId);
  if (currentListing && currentListing.listingId !== ids.listingId) {
    throw new Error('E2E room already has a different current Listing');
  }

  const expectedListing = {
    listingId: ids.listingId,
    roomId: ids.roomId,
    status: 'PUBLISHED',
    publicTitle: fixture.listing.publicTitle,
    publicDescription: fixture.listing.publicDescription,
    publicPriceProjection: fixture.listing.publicPriceProjection,
    publicLocationProjection: fixture.publicLocationProjection,
  };
  const listing = await repositories.listing.findListing(ids.listingId);
  if (!listing) {
    await repositories.listing.createListing(expectedListing);
  } else {
    await repositories.listing.updateListing(expectedListing);
  }

  const statusEvents = await repositories.listing.findStatusEvents(ids.listingId);
  if (!statusEvents.some((event) => event.listingStatusEventId === ids.listingPublishedEventId)) {
    await repositories.listing.insertStatusEvent({
      listingStatusEventId: ids.listingPublishedEventId,
      listingId: ids.listingId,
      fromStatus: 'DRAFT',
      toStatus: 'PUBLISHED',
      reasonCode: 'E2E_FIXTURE',
      actorType: 'SYSTEM',
      actorUserId: ids.operatorUserId,
      trigger: 'E2E_SEED',
      occurredAt: fixture.listing.publishedAt,
      metadata: { fixture: 'discovery' },
    });
  }
}

async function main(): Promise<void> {
  assertSafeE2eDatabaseUrl(process.env.DATABASE_URL);
  const db = createDatabaseClient(loadDatabaseConfig(process.env));
  try {
    const transactions = new PostgresTransactionManager(db, createRepositorySet);
    await transactions.run(seedDiscoveryFixture);
    console.log(`Seeded E2E Listing ${fixture.ids.listingId}`);
  } finally {
    await db.destroy();
  }
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'E2E seed failed');
    process.exitCode = 1;
  });
}
