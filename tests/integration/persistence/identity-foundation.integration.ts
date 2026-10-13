import assert from 'node:assert/strict';
import {
  loadGooglePrincipals,
  loadPersistenceScenarios,
  loadLegacyCompatibility,
} from '../../support/identity-fixtures';
const G = loadGooglePrincipals();
const F = loadPersistenceScenarios();
const L = loadLegacyCompatibility();
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { Client } from 'pg';

import { runMigrations } from '../../../scripts/database/migrate';
import { IdentityAccessService } from '../../../src/modules/identity-access/services/identity-access.service';
import { queryCatalog, resetPublicSchema } from './support/postgres-test-harness';
import { rentalFixture } from './support/identity-legacy-fixture';

test('concurrent Google authentication preserves User references and never links by matching email', async () => {
  const url = process.env.TEST_DATABASE_URL;
  assert.ok(url, 'TEST_DATABASE_URL is required');
  const fixture = await rentalFixture(url);
  const userId = G.userFirst;
  const organizationId = L.ids.organization;
  const participantId = L.ids.participant;
  const unregisteredParticipantId = L.ids.unregisteredParticipant;
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await fixture.manager.run(async ({ repositories }) => {
      await repositories.identity.ensureUser(userId);
      await repositories.organization.createOrganization({
        organizationId,
        primaryOwnerUserId: userId,
        name: L.organizationName,
      });
      await repositories.tenancy.createTenancy({
        tenancyId: fixture.ids.tenancy,
        roomId: fixture.ids.room,
        status: F.values.draftTenancy,
        startedAt: F.states.tenancyStartedAt,
        endedAt: F.states.tenancyEndedAt,
        endReason: F.states.tenancyEndReason,
      });
      for (const participant of [
        { id: participantId, userId },
        { id: unregisteredParticipantId, userId: F.states.unregisteredUserId },
      ]) {
        await repositories.tenancy.insertParticipant({
          tenancyParticipantId: participant.id,
          tenancyId: fixture.ids.tenancy,
          userId: participant.userId,
          role: F.values.occupantRole,
          joinedAt: L.joinedAt,
          leftAt: F.states.participantLeftAt,
        });
      }
    });
    const referencesBefore = await fixture.manager.run(async ({ repositories }) => ({
      organization: await repositories.organization.findOrganization(organizationId),
      participants: await repositories.tenancy.findParticipantsByTenancy(fixture.ids.tenancy),
    }));
    const service = new IdentityAccessService(fixture.manager, {
      // Only the external provider is substituted; service, transactions and repositories are real.
      verify: async (subject) => ({
        issuer: F.values.canonicalIssuer,
        subject,
        email: L.email,
        emailVerified: L.emailVerified,
      }),
    });
    const principals = await Promise.all(
      Array.from({ length: F.configuration.registrationConcurrency }, () =>
        service.authenticateWithGoogle({ idToken: G.subjectFirst }),
      ),
    );
    assert.ok(principals.every((principal) => principal.userId === userId));
    assert.equal(
      (
        await fixture.db
          .selectFrom('users')
          .select('user_id')
          .where('user_id', '=', userId)
          .execute()
      ).length,
      1,
    );
    assert.deepEqual(await service.getSessionContext(principals[0]!), {
      userId,
      operatedOrganizationIds: [organizationId],
      linkedTenancyIds: [fixture.ids.tenancy],
      email: L.email,
    });

    const other = await service.authenticateWithGoogle({ idToken: G.subjectSecond });
    assert.equal(other.userId, G.userSecond);
    assert.deepEqual(await service.getSessionContext(other), {
      userId: other.userId,
      operatedOrganizationIds: [],
      linkedTenancyIds: [],
      email: L.email,
    });
    assert.deepEqual(
      await fixture.manager.run(async ({ repositories }) => ({
        organization: await repositories.organization.findOrganization(organizationId),
        participants: await repositories.tenancy.findParticipantsByTenancy(fixture.ids.tenancy),
      })),
      referencesBefore,
    );
    assert.equal(
      (await fixture.tenancies.findParticipant(unregisteredParticipantId))?.userId,
      F.states.unregisteredUserId,
    );
    await assert.rejects(
      client.query('DELETE FROM users WHERE user_id = $1', [userId]),
      (error: unknown) =>
        error instanceof Error && 'code' in error && error.code === L.foreignKeyViolationCode,
    );

    const unavailable = new IdentityAccessService(fixture.manager, {
      verify: async () => {
        throw new Error(L.providerFailure);
      },
    });
    const usersBefore = await fixture.db
      .selectFrom('users')
      .selectAll()
      .orderBy('user_id')
      .execute();
    await assert.rejects(
      unavailable.authenticateWithGoogle({ idToken: L.unavailableToken }),
      new RegExp(L.providerFailure),
    );
    assert.deepEqual(
      await fixture.db.selectFrom('users').selectAll().orderBy('user_id').execute(),
      usersBefore,
    );
  } finally {
    await client.end();
    await fixture.db.destroy();
  }
});

test('frozen v1 snapshot upgrades without rekeying Users and empty migration rollback can bootstrap again', async () => {
  const url = process.env.TEST_DATABASE_URL;
  assert.ok(url, 'TEST_DATABASE_URL is required');
  await resetPublicSchema(url);
  assert.equal(
    readFileSync('database/migrations/sql/000001_initial_schema.up.sql', 'utf8'),
    readFileSync('docs/database/v1/schema/trooi-schema-20260927T153946Z.sql', 'utf8'),
  );
  const { runner } = await import('node-pg-migrate');
  await runner({
    databaseUrl: url,
    direction: 'up',
    count: 1,
    dir: join(process.cwd(), 'database/migrations'),
    migrationsTable: 'schema_migrations',
    checkOrder: true,
  });
  const catalogBefore = await queryCatalog(url);
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const userId = G.userFirst;
    const organizationId = L.ids.upgradeOrganization;
    await client.query('INSERT INTO users (user_id) VALUES ($1)', [userId]);
    await client.query(
      'INSERT INTO organizations (organization_id, primary_owner_user_id, name) VALUES ($1, $2, $3)',
      [organizationId, userId, L.upgradeOrganizationName],
    );
    const usersBefore = (await client.query('SELECT * FROM users ORDER BY user_id')).rows;
    const organizationsBefore = (
      await client.query('SELECT * FROM organizations ORDER BY organization_id')
    ).rows;
    await runMigrations('up', url);
    await runMigrations('up', url);
    assert.deepEqual(
      (await client.query('SELECT * FROM users ORDER BY user_id')).rows,
      usersBefore,
    );
    assert.deepEqual(
      (await client.query('SELECT * FROM organizations ORDER BY organization_id')).rows,
      organizationsBefore,
    );
    const upgraded = await queryCatalog(url);
    for (const [kind, names] of Object.entries(catalogBefore))
      assert.ok(
        names.every((name: string) => upgraded[kind as keyof typeof upgraded].includes(name)),
        kind + ' v1 entries preserved',
      );

    // Destructive down verification is confined to an empty isolated test schema.
    await resetPublicSchema(url);
    await runMigrations('up', url);
    const count = (
      await client.query<{ count: number }>('SELECT count(*)::int AS count FROM schema_migrations')
    ).rows[0]!.count;
    for (let index = 0; index < count; index++) await runMigrations('down', url);
    assert.equal((await queryCatalog(url)).tables.length, 0);
    await runMigrations('up', url);
    const rebuilt = await queryCatalog(url);
    for (const [kind, names] of Object.entries(catalogBefore))
      assert.ok(
        names.every((name: string) => rebuilt[kind as keyof typeof rebuilt].includes(name)),
        kind + ' v1 entries rebuilt',
      );
  } finally {
    await client.end();
  }
});
