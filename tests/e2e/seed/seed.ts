import { createDatabaseClient } from '../../../src/infrastructure/database/database.client';
import { loadDatabaseConfig } from '../../../src/infrastructure/database/database.config';
import { PostgresTransactionManager } from '../../../src/infrastructure/database/postgres-transaction-manager';
import { createRepositorySet } from '../../../src/infrastructure/database/repositories/repository-set';
import type { TransactionManager } from '../../../src/persistence/ports/transaction-manager';
import { ListingService } from '../../../src/modules/listing/services/listing.service';
import { OrganizationService } from '../../../src/modules/organization/services/organization.service';
import { PropertyService } from '../../../src/modules/property/services/property.service';
import { RoomService } from '../../../src/modules/room/services/room.service';
import { TenancyService } from '../../../src/modules/tenancy/services/tenancy.service';
import { TenancyParticipantService } from '../../../src/modules/tenancy/services/tenancy-participant.service';
import { RentalLifecycleCoordinator } from '../../../src/modules/rental-lifecycle/services/rental-lifecycle.coordinator';
import { DISCOVERY_FIXTURE as fixture } from '../fixtures/discovery';
import { assertSafeE2eDatabaseUrl } from './database';

export async function seedDiscoveryFixture(transactions: TransactionManager): Promise<void> {
  const { ids } = fixture;

  await transactions.run(async ({ repositories }) => {
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
  });

  const existing = await transactions.run(({ repositories }) =>
    repositories.listing.findListing(ids.listingId),
  );
  const listings = new ListingService(transactions);
  if (!existing) {
    await listings.createDraft({
      id: ids.listingId,
      roomId: ids.roomId,
      publicTitle: fixture.listing.publicTitle,
      publicDescription: fixture.listing.publicDescription,
      publicPriceProjection: fixture.listing.publicPriceProjection,
      publicLocationProjection: fixture.publicLocationProjection,
    });
  } else if (
    existing.roomId !== ids.roomId ||
    existing.publicTitle !== fixture.listing.publicTitle ||
    existing.publicDescription !== fixture.listing.publicDescription ||
    existing.publicPriceProjection !== fixture.listing.publicPriceProjection ||
    existing.publicLocationProjection.latitude !== fixture.publicLocationProjection.latitude ||
    existing.publicLocationProjection.longitude !== fixture.publicLocationProjection.longitude
  ) {
    throw new Error('E2E Listing ID collision with different public data');
  }

  const organizations = new OrganizationService(transactions);
  const properties = new PropertyService(organizations, transactions);
  const rooms = new RoomService(properties, transactions);
  const tenancies = new TenancyService(transactions);
  const participants = new TenancyParticipantService(tenancies, transactions);
  const lifecycle = new RentalLifecycleCoordinator(rooms, properties, listings, tenancies, participants);
  const listing = await listings.findById(ids.listingId);
  if (listing.status !== 'published') {
    await lifecycle.publishListing(ids.listingId, {
      reasonCode: fixture.listing.publishReason,
      actorType: 'USER',
      actorUserId: ids.operatorUserId,
      trigger: 'COMMAND',
      occurredAt: fixture.listing.publishedAt,
    });
  }
}

async function main(): Promise<void> {
  assertSafeE2eDatabaseUrl(process.env.DATABASE_URL);
  const db = createDatabaseClient(loadDatabaseConfig(process.env));
  try {
    const transactions = new PostgresTransactionManager(db, createRepositorySet);
    await seedDiscoveryFixture(transactions);
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
