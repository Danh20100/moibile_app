import assert from 'node:assert/strict';
import test from 'node:test';
import { sql } from 'kysely';
import { rentalFixture } from './persistence/guards/rental-test-support';
import { PostgresIdentityRepository } from '../../src/infrastructure/database/repositories/identity.repository';
import { TenancyJoinService, joinTokenHash } from '../../src/modules/tenancy/services/tenancy-join.service';
import { runMigrations } from '../../scripts/database/migrate';

test('join invitation is tied to a current occupied tenancy, expires and cannot be replayed', async () => {
  const url = process.env.TEST_DATABASE_URL;
  assert.ok(url);
  const fixture = await rentalFixture(url, { initializeDatabase: async db => runMigrations('up', db) });
  try {
    await fixture.tenancies.createTenancy({
      tenancyId: fixture.ids.tenancy,
      roomId: fixture.ids.room,
      status: 'ACTIVE',
      startedAt: '2026-01-01T00:00:00.000Z',
      endedAt: null,
      endReason: null,
    });
    const participantId = 'a2000000-0000-4000-8000-000000000001';
    await fixture.tenancies.insertParticipant({
      tenancyParticipantId: participantId,
      tenancyId: fixture.ids.tenancy,
      userId: null,
      role: 'PRIMARY',
      joinedAt: '2026-01-01T00:00:00.000Z',
      leftAt: null,
    });
    const join = new TenancyJoinService(fixture.db);
    await assert.rejects(join.issue(fixture.ids.tenancy, fixture.ids.user));
    await sql`UPDATE rooms SET operational_state = 'OCCUPIED' WHERE room_id = ${fixture.ids.room}::uuid`.execute(fixture.db);
    const first = await join.issue(fixture.ids.tenancy, fixture.ids.user);
    assert.equal(first.token.length, 64);
    assert.equal(first.room.length > 0, true);
    assert.equal((await join.preview(first.token)).room, first.room);
    const replacement = await join.issue(fixture.ids.tenancy, fixture.ids.user);
    await assert.rejects(join.preview(first.token));
    await sql`
      UPDATE tenancy_join_invitations SET issued_at = now() - interval '3 days',
        expires_at = now() - interval '1 day'
      WHERE token_hash = ${joinTokenHash(replacement.token)}
    `.execute(fixture.db);
    await assert.rejects(join.preview(replacement.token));
    await assert.rejects(join.accept(replacement.token, fixture.ids.user));
    const current = await join.issue(fixture.ids.tenancy, fixture.ids.user);
    const nextUser = 'a3000000-0000-4000-8000-000000000001';
    await new PostgresIdentityRepository(fixture.db).ensureUser(nextUser);
    const accepted = await join.accept(current.token, nextUser);
    assert.equal(accepted.tenancyId, fixture.ids.tenancy);
    await assert.rejects(join.accept(current.token, nextUser));
    await assert.rejects(join.preview(current.token));
    await assert.rejects(join.issue(fixture.ids.tenancy, fixture.ids.user));
    const rows = await sql<{ user_id: string }>`
      SELECT user_id FROM tenancy_participants WHERE tenancy_participant_id = ${participantId}::uuid
    `.execute(fixture.db);
    assert.equal(rows.rows[0]?.user_id, nextUser);
  } finally {
    await fixture.db.destroy();
  }
});
