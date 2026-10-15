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
import { rentalPersistenceFixture as data } from '../../../support/rental-fixtures';

export async function rentalFixture(
  url: string,
  options: { initializeDatabase?: (url: string) => Promise<void> } = {},
) {
  if (options.initializeDatabase) {
    await options.initializeDatabase(url);
  } else {
    await resetPublicSchema(url);
    await runMigrations('up', url);
  }
  const db = createDatabaseClient({ url, maxPoolSize: 10, connectionTimeoutMs: 5000 });
  try {
    const ids = { ...data.ids };
    await new PostgresIdentityRepository(db).ensureUser(ids.user);
    await new PostgresOrganizationRepository(db).createOrganization({ ...data.organization });
    const p = new PostgresPropertyRepository(db);
    await p.createProperty({ ...data.property });
    await p.createRoom({ ...data.room });
    const listings = new PostgresListingRepository(db);
    await listings.createListing({ ...data.listing });
    return {
      db,
      ids,
      p,
      listings,
      tenancies: new PostgresTenancyRepository(db),
      manager: new PostgresTransactionManager(db, createRepositorySet),
    };
  } catch (error) {
    await db.destroy();
    throw error;
  }
}
