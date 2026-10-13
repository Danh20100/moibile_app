import { loadRentalReference } from '../../../support/identity-fixtures';
import { createDatabaseClient } from '../../../../src/infrastructure/database/database.client';
import { PostgresIdentityRepository } from '../../../../src/infrastructure/database/repositories/identity.repository';
import { PostgresOrganizationRepository } from '../../../../src/infrastructure/database/repositories/organization.repository';
import { PostgresPropertyRepository } from '../../../../src/infrastructure/database/repositories/property.repository';
import { PostgresListingRepository } from '../../../../src/infrastructure/database/repositories/listing.repository';
import { PostgresTenancyRepository } from '../../../../src/infrastructure/database/repositories/tenancy.repository';
import { PostgresTransactionManager } from '../../../../src/infrastructure/database/postgres-transaction-manager';
import { createRepositorySet } from '../../../../src/infrastructure/database/repositories/repository-set';
import { runMigrations } from '../../../../scripts/database/migrate';
import { resetPublicSchema } from '../support/postgres-test-harness';
export async function rentalFixture(url: string) {
  await resetPublicSchema(url);
  await runMigrations('up', url);
  const db = createDatabaseClient({ url, maxPoolSize: 10, connectionTimeoutMs: 5000 });
  const fixture = loadRentalReference();
  const ids = fixture.ids;
  await new PostgresIdentityRepository(db).ensureUser(ids.user);
  await new PostgresOrganizationRepository(db).createOrganization({
    organizationId: ids.org,
    primaryOwnerUserId: ids.user,
    name: fixture.organizationName,
  });
  const p = new PostgresPropertyRepository(db);
  await p.createProperty({
    propertyId: ids.property,
    organizationId: ids.org,
    name: fixture.propertyName,
    lifecycleStatus: fixture.propertyLifecycle,
    operationalAddressText: fixture.address,
    operationalLocation: { longitude: fixture.longitude, latitude: fixture.latitude },
    publicLocationProjection: { longitude: fixture.longitude, latitude: fixture.latitude },
  });
  await p.createRoom({
    roomId: ids.room,
    propertyId: ids.property,
    nameOrLabel: fixture.roomName,
    operationalState: fixture.roomState,
    recordLifecycle: fixture.roomLifecycle,
  });
  await new PostgresListingRepository(db).createListing({
    listingId: ids.listing,
    roomId: ids.room,
    status: fixture.listingStatus,
    publicTitle: fixture.listingTitle,
    publicDescription: fixture.listingDescription,
    publicPriceProjection: fixture.listingPrice,
    publicLocationProjection: { longitude: fixture.longitude, latitude: fixture.latitude },
  });
  return {
    db,
    ids,
    p,
    listings: new PostgresListingRepository(db),
    tenancies: new PostgresTenancyRepository(db),
    manager: new PostgresTransactionManager(db, createRepositorySet),
  };
}
