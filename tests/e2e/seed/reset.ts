import { createDatabaseClient } from '../../../src/infrastructure/database/database.client';
import { loadDatabaseConfig } from '../../../src/infrastructure/database/database.config';
import { E2E_IDS } from '../fixtures/ids';
import { assertSafeE2eDatabaseUrl } from './database';

async function main(): Promise<void> {
  assertSafeE2eDatabaseUrl(process.env.DATABASE_URL);
  const db = createDatabaseClient(loadDatabaseConfig(process.env));

  try {
    await db.transaction().execute(async (transaction) => {
      await transaction
        .deleteFrom('inquiries')
        .where('listing_id', '=', E2E_IDS.listingId)
        .execute();
      await transaction
        .deleteFrom('listing_status_events')
        .where('listing_id', '=', E2E_IDS.listingId)
        .execute();
      await transaction
        .deleteFrom('listings')
        .where('listing_id', '=', E2E_IDS.listingId)
        .execute();
      await transaction.deleteFrom('rooms').where('room_id', '=', E2E_IDS.roomId).execute();
      await transaction
        .deleteFrom('properties')
        .where('property_id', '=', E2E_IDS.propertyId)
        .execute();
      await transaction
        .deleteFrom('organizations')
        .where('organization_id', '=', E2E_IDS.organizationId)
        .execute();
      await transaction.deleteFrom('users').where('user_id', '=', E2E_IDS.operatorUserId).execute();
    });
    console.log(`Reset E2E fixture ${E2E_IDS.listingId}`);
  } finally {
    await db.destroy();
  }
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'E2E reset failed');
    process.exitCode = 1;
  });
}
