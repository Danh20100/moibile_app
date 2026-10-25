import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { ConflictException } from '@nestjs/common';
import { Kysely, PostgresDialect, sql } from 'kysely';
import { Pool } from 'pg';

import type { Database } from '../../../src/infrastructure/database/schema.types';
import { RoomService } from '../../../src/modules/room/services/room.service';

const url = process.env.TEST_DATABASE_URL;
// Only disposable, isolated DBs may run these destructive setup statements.
const safe = Boolean(url && new URL(url).pathname === '/trooi_slot_audit');

test(
  'PostgreSQL owner quota: cross-property concurrent creates, verified expiry and idempotency',
  {
    skip: safe ? undefined : 'Requires isolated TEST_DATABASE_URL ending in /trooi_slot_audit',
  },
  async () => {
    const pool = new Pool({ connectionString: url, max: 16 });
    const db = new Kysely<Database>({ dialect: new PostgresDialect({ pool }) });
    try {
      await sql`CREATE TABLE organizations (organization_id uuid PRIMARY KEY, primary_owner_user_id uuid NOT NULL)`.execute(
        db,
      );
      await sql`CREATE TABLE properties (property_id uuid PRIMARY KEY, organization_id uuid NOT NULL REFERENCES organizations, lifecycle_status text NOT NULL)`.execute(
        db,
      );
      await sql`CREATE TABLE rooms (room_id uuid PRIMARY KEY, property_id uuid NOT NULL REFERENCES properties, name_or_label text NOT NULL, operational_state text NOT NULL, record_lifecycle text NOT NULL)`.execute(
        db,
      );
      await sql`CREATE TABLE owner_slot_entitlements (entitlement_id uuid PRIMARY KEY, owner_user_id uuid NOT NULL, status text NOT NULL, valid_until timestamptz NOT NULL)`.execute(
        db,
      );

      const owner = randomUUID(),
        otherOwner = randomUUID();
      const orgA = randomUUID(),
        orgB = randomUUID(),
        orgOther = randomUUID();
      const propA = randomUUID(),
        propB = randomUUID(),
        propOther = randomUUID();
      for (const [org, account] of [
        [orgA, owner],
        [orgB, owner],
        [orgOther, otherOwner],
      ]) {
        await sql`INSERT INTO organizations VALUES (${org}::uuid, ${account}::uuid)`.execute(db);
      }
      for (const [property, org] of [
        [propA, orgA],
        [propB, orgB],
        [propOther, orgOther],
      ]) {
        await sql`INSERT INTO properties VALUES (${property}::uuid, ${org}::uuid, 'ACTIVE')`.execute(
          db,
        );
      }
      const rooms = new RoomService({} as never, {} as never, db);

      const candidates = Array.from({ length: 12 }, (_, i) => ({
        id: randomUUID(),
        propertyId: i % 2 === 0 ? propA : propB,
        nameOrLabel: 'R' + i,
      }));
      const firstWave = await Promise.allSettled(candidates.map((room) => rooms.create(room)));
      assert.equal(firstWave.filter((r) => r.status === 'fulfilled').length, 1);
      assert.equal(
        firstWave.filter((r) => r.status === 'rejected' && r.reason instanceof ConflictException)
          .length,
        11,
      );
      const original = candidates[firstWave.findIndex((r) => r.status === 'fulfilled')]!;
      assert.equal(
        (await rooms.create(original)).id,
        original.id,
        'identical retries consume no extra slot',
      );
      await assert.rejects(
        rooms.create({
          id: original.id,
          propertyId: original.propertyId,
          nameOrLabel: 'different',
        }),
        /different payload/,
      );

      const other = await rooms.create({ propertyId: propOther, nameOrLabel: 'Other owner first' });
      assert.ok(other.id);
      const entitlement = randomUUID();
      await sql`INSERT INTO owner_slot_entitlements VALUES
      (${entitlement}::uuid, ${owner}::uuid, 'PROVIDER_VERIFIED', now() + interval '1 day')`.execute(
        db,
      );
      const secondWave = await Promise.allSettled(
        Array.from({ length: 10 }, (_, i) =>
          rooms.create({
            propertyId: i % 2 === 0 ? propA : propB,
            nameOrLabel: 'Extra ' + i,
          }),
        ),
      );
      assert.equal(secondWave.filter((r) => r.status === 'fulfilled').length, 1);
      assert.equal(
        secondWave.filter((r) => r.status === 'rejected' && r.reason instanceof ConflictException)
          .length,
        9,
      );
      const counts = await sql<{ used: number }>`SELECT count(*)::integer AS used FROM rooms r
      JOIN properties p ON p.property_id = r.property_id
      JOIN organizations o ON o.organization_id = p.organization_id
      WHERE o.primary_owner_user_id = ${owner}::uuid AND r.record_lifecycle = 'ACTIVE'`.execute(db);
      assert.equal(counts.rows[0]?.used, 2);

      await sql`UPDATE owner_slot_entitlements SET valid_until = now() - interval '1 day'
      WHERE entitlement_id = ${entitlement}::uuid`.execute(db);
      await assert.rejects(
        rooms.create({ propertyId: propA, nameOrLabel: 'After expiry' }),
        ConflictException,
      );
    } finally {
      await db.destroy();
    }
  },
);
