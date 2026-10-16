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
import { GooglePrincipalResolver } from '../../../src/modules/identity-access/services/google-principal-resolver';
import { ServiceUnavailableException } from '@nestjs/common';
import { queryCatalog, resetPublicSchema } from './support/postgres-test-harness';
import { rentalFixture } from './support/identity-legacy-fixture';

test('concurrent Google authentication preserves User references and never links by matching email', async () => {
  const url = process.env.TEST_DATABASE_URL;
  assert.ok(url, 'TEST_DATABASE_URL is required');
  const fixture = await rentalFixture(url);
  const userId = G.userFirst;
  const organizationId = L.ids.organization;
  const legacyUnboundUserId = G.userSecond;
  const legacyUnboundOrganizationId = L.ids.upgradeOrganization;
  const participantId = L.ids.participant;
  const unregisteredParticipantId = L.ids.unregisteredParticipant;
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await fixture.manager.run(async ({ repositories }) => {
      await repositories.identity.ensureUser(userId);
      await repositories.identity.ensureUser(legacyUnboundUserId);
      await repositories.organization.createOrganization({
        organizationId,
        primaryOwnerUserId: userId,
        name: L.organizationName,
      });
      await repositories.organization.createOrganization({
        organizationId: legacyUnboundOrganizationId,
        primaryOwnerUserId: legacyUnboundUserId,
        name: L.upgradeOrganizationName,
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
    // The legacy User is adopted only through an explicit, reviewed durable binding.
    await client.query(
      `INSERT INTO auth_identities (auth_identity_id, user_id, provider, issuer, subject, linked_at)
       VALUES ($1, $2, 'google', $3, $4, $5)`,
      [F.ids.foundationLegacyIdentity, userId, F.values.canonicalIssuer, G.subjectFirst, L.joinedAt],
    );
    const referencesBefore = await fixture.manager.run(async ({ repositories }) => ({
      organization: await repositories.organization.findOrganization(organizationId),
      legacyUnboundOrganization: await repositories.organization.findOrganization(legacyUnboundOrganizationId),
      participants: await repositories.tenancy.findParticipantsByTenancy(fixture.ids.tenancy),
    }));
    const verifier = {
      // Only the external provider is substituted; service, transactions and repositories are real.
      verify: async (token: string) => ({
        issuer: token === F.values.aliasRace ? F.values.bareIssuer : F.values.canonicalIssuer,
        subject: token === F.values.aliasRace ? G.subjectFirst : token,
        email: L.email,
        emailVerified: L.emailVerified,
      }),
    };
    const resolver = new GooglePrincipalResolver(fixture.manager, verifier, true, true);
    const service = new IdentityAccessService(fixture.manager, resolver);
    const principals = await Promise.all(
      Array.from({ length: F.configuration.registrationConcurrency }, () =>
        service.authenticateWithGoogle({ idToken: G.subjectFirst }),
      ),
    );
    assert.ok(principals.every((principal) => principal.userId === userId));
    assert.equal((await service.authenticateWithGoogle({ idToken: F.values.aliasRace })).userId, userId);
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

    await assert.rejects(
      service.authenticateWithGoogle({ idToken: G.subjectSecond }),
      ServiceUnavailableException,
    );
    assert.deepEqual(
      await fixture.db.selectFrom('users').select('user_id').where('user_id', '=', G.userSecond).executeTakeFirst(),
      { user_id: legacyUnboundUserId },
    );
    assert.deepEqual(
      await fixture.manager.run(async ({ repositories }) => ({
        organization: await repositories.organization.findOrganization(organizationId),
        legacyUnboundOrganization: await repositories.organization.findOrganization(legacyUnboundOrganizationId),
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

    const unavailable = new IdentityAccessService(fixture.manager, new GooglePrincipalResolver(fixture.manager, {
      verify: async () => {
        throw new Error(L.providerFailure);
      },
    }, true, true));
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

test('frozen v1 snapshot upgrades without rekeying Users and media rollback guard preserves the schema', async () => {
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

    // Data-bearing Identity sessions/audit rows block rollback; empty additive migrations may roll back.
    await resetPublicSchema(url);
    await runMigrations('up', url);
    await client.query('INSERT INTO users (user_id) VALUES ($1)', [G.userFirst]);
    await client.query(
      `INSERT INTO auth_sessions (session_id, family_id, user_id, access_token_sha256, access_expires_at,
        refresh_token_sha256, created_at, last_seen_at, idle_expires_at, absolute_expires_at, authenticated_at)
       VALUES ($1, $1, $2, $3, now() + interval '15 minutes', $4, now(), now(), now() + interval '30 days',
        now() + interval '90 days', now())`,
      [F.ids.sessionRollbackId, G.userFirst, 'a'.repeat(64), 'b'.repeat(64)],
    );
    await assert.rejects(runMigrations('down', url), /Migration 000016 contains Identity session\/security data/);

    await resetPublicSchema(url);
    await runMigrations('up', url);
    await runMigrations('down', url); // 000016: no session, challenge or audit data
    await runMigrations('down', url); // 000015: no avatar data or intents
    await runMigrations('down', url); // 000014: no pending Messaging uploads
    await runMigrations('down', url); // 000013: no pending Listing intents
    await runMigrations('down', url); // 000012: no public-photo records
    await assert.rejects(
      runMigrations('down', url),
      /Migration 000011 contains user-uploaded private Asset photos/,
    );
    assert.ok((await queryCatalog(url)).tables.includes('listing_asset_media'));
    // Reset the disposable test schema through the explicitly guarded test harness.
    await resetPublicSchema(url);
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
