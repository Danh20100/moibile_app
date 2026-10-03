import assert from 'node:assert/strict';
import test from 'node:test';

import { sql } from 'kysely';

import { runMigrations } from '../../../scripts/database/migrate';
import { createDatabaseClient } from '../../../src/infrastructure/database/database.client';
import { PostgresListingSearchRepository } from '../../../src/infrastructure/database/repositories/listing-search.repository';
import { resetPublicSchema } from './support/postgres-test-harness';

test('public spatial search returns only published in-range public projections and applies price range', async () => {
  const url = process.env.TEST_DATABASE_URL;
  assert.ok(url);
  await resetPublicSchema(url);
  await runMigrations('up', url);
  const db = createDatabaseClient({ url, maxPoolSize: 2, connectionTimeoutMs: 5000 });
  try {
    await sql`INSERT INTO users VALUES ('90000000-0000-4000-8000-000000000001')`.execute(db);
    await sql`INSERT INTO organizations VALUES ('20000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000001','Org')`.execute(db);
    for (const [i, lon, status] of [
      ['1', 106.7001, 'PUBLISHED'],
      ['2', 107.5, 'PUBLISHED'],
      ['3', 106.7002, 'UNPUBLISHED'],
    ] as const) {
      await sql`INSERT INTO properties VALUES (${`30000000-0000-4000-8000-00000000000${i}`},'20000000-0000-4000-8000-000000000001','P','ACTIVE','SECRET',ST_MakePoint(110,20)::geography,ST_MakePoint(${lon},10.7)::geography)`.execute(db);
      await sql`INSERT INTO rooms VALUES (${`40000000-0000-4000-8000-00000000000${i}`},${`30000000-0000-4000-8000-00000000000${i}`},'R','VACANT','ACTIVE')`.execute(db);
      await sql`INSERT INTO listings VALUES (${`50000000-0000-4000-8000-00000000000${i}`},${`40000000-0000-4000-8000-00000000000${i}`},${status},'T','D',1,ST_MakePoint(${lon},10.7)::geography)`.execute(db);
    }

    const repository = new PostgresListingSearchRepository(db);
    const rows = await repository.findPublishedWithinRadius(
      { longitude: 106.7, latitude: 10.7 },
      1000,
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.listingId, '50000000-0000-4000-8000-000000000001');
    assert.ok(Math.abs((rows[0]?.publicLocation.longitude ?? 0) - 106.7001) < 0.00001);
    assert.ok((rows[0]?.distanceMeters ?? Infinity) < 1000);

    assert.equal(
      (await repository.findPublishedWithinRadius(
        { longitude: 106.7, latitude: 10.7 },
        1000,
        '1.00',
        '1.00',
      )).length,
      1,
    );
    assert.equal(
      (await repository.findPublishedWithinRadius(
        { longitude: 106.7, latitude: 10.7 },
        1000,
        '2.00',
      )).length,
      0,
    );

    await sql`SET enable_seqscan=off`.execute(db);
    const plan = await sql<Record<string, string>>`
      EXPLAIN (COSTS OFF)
      SELECT listing_id FROM listings
      WHERE status='PUBLISHED'
        AND ST_DWithin(public_location_projection,ST_MakePoint(106.7,10.7)::geography,1000)
    `.execute(db);
    assert.match(plan.rows.flatMap(Object.values).join('\n'), /Index Scan using ix_listings_published_location/i);

    await assert.rejects(
      repository.findPublishedWithinRadius({ longitude: 0, latitude: 0 }, -1),
      RangeError,
    );
  } finally {
    await db.deleteFrom('listings').where('listing_id', 'in', [
      '50000000-0000-4000-8000-000000000001',
      '50000000-0000-4000-8000-000000000002',
      '50000000-0000-4000-8000-000000000003',
    ]).execute();
    await db.deleteFrom('rooms').where('room_id', 'in', [
      '40000000-0000-4000-8000-000000000001',
      '40000000-0000-4000-8000-000000000002',
      '40000000-0000-4000-8000-000000000003',
    ]).execute();
    await db.deleteFrom('properties').where('property_id', 'in', [
      '30000000-0000-4000-8000-000000000001',
      '30000000-0000-4000-8000-000000000002',
      '30000000-0000-4000-8000-000000000003',
    ]).execute();
    await db.deleteFrom('organizations').where('organization_id', '=', '20000000-0000-4000-8000-000000000001').execute();
    await db.deleteFrom('users').where('user_id', '=', '90000000-0000-4000-8000-000000000001').execute();
    await db.destroy();
  }
});
