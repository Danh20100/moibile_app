import { createIdentityTestBarrier } from './support/identity-test-barrier';
import { PersistenceDeadlock } from '../../../src/persistence/errors';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadPersistenceScenarios } from '../../support/identity-fixtures';
const F = loadPersistenceScenarios();
import { sql } from 'kysely';
import { PostgresIdentityFoundationRepository } from '../../../src/infrastructure/database/repositories/identity-foundation.repository';
import { PostgresTransactionManager } from '../../../src/infrastructure/database/postgres-transaction-manager';
import { createRepositorySet } from '../../../src/infrastructure/database/repositories/repository-set';
import { createDatabaseClient } from '../../../src/infrastructure/database/database.client';
import { googlePrincipalUserId } from '../../../src/common/identity/deterministic-user-id';
import test from 'node:test';
import {
  prepareIdentityMigrationChain,
  initializeIdentityTestDatabase,
  prepareMissingPredecessorChain,
} from './support/identity-vnext-migrations';

import { Client } from 'pg';
import { resetPublicSchema } from './support/postgres-test-harness';

test('combined integration baseline creates the frozen four-table identity foundation', async () => {
  const url = process.env.TEST_DATABASE_URL;
  assert.ok(url, 'isolated TEST_DATABASE_URL required');
  const migrationChain = prepareIdentityMigrationChain();
  await initializeIdentityTestDatabase(url, 7);
  const { runner } = await import('node-pg-migrate');
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const legacy = F.ids.upgradeUser,
      organization = F.ids.upgradeOrganization;
    await client.query('INSERT INTO users(user_id) VALUES ($1)', [legacy]);
    await client.query(
      'INSERT INTO organizations(organization_id,primary_owner_user_id,name) VALUES ($1,$2,$3)',
      [organization, legacy, F.values.populatedUpgradeFixture],
    );
    const before = (
      await client.query('SELECT * FROM organizations WHERE organization_id=$1', [organization])
    ).rows;
    await runner({
      databaseUrl: url,
      dir: migrationChain.dir,
      direction: 'up',
      migrationsTable: 'schema_migrations',
      checkOrder: true,
      log: () => undefined,
    });
    assert.deepEqual(
      (await client.query('SELECT * FROM organizations WHERE organization_id=$1', [organization]))
        .rows,
      before,
    );
    assert.equal(
      (
        await client.query('SELECT count(*)::int AS n FROM auth_identities WHERE user_id=$1', [
          legacy,
        ])
      ).rows[0].n,
      0,
    );
    const physical = JSON.parse(
      readFileSync('docs/database/vnext/identity-foundation/physical.json', 'utf8'),
    );
    for (const table of physical.tables) {
      assert.ok(
        (await client.query('SELECT to_regclass($1) AS relation', ['public.' + table.name])).rows[0]
          .relation,
        table.name + ' must exist',
      );
    }
  } finally {
    await client.end();
  }
});

test('real PostgreSQL identity persistence satisfies frozen compatibility and concurrency contracts', async (t) => {
  const url = process.env.TEST_DATABASE_URL!;
  await initializeIdentityTestDatabase(url);
  t.beforeEach(async () => initializeIdentityTestDatabase(url));
  const db = createDatabaseClient({ url, maxPoolSize: 12, connectionTimeoutMs: 5000 });
  const now = F.values.now;
  const later = F.values.later;
  const principal = (
    subject: string,
    issuer: 'accounts.google.com' | 'https://accounts.google.com' = F.values.canonicalIssuer,
  ) => ({ subject, issuer });
  const email = (address: string) => ({
    address,
    normalizedEmail: address.toLowerCase(),
    verificationSource: F.values.googleProvider,
    verifiedAt: now,
  });
  const run = <T>(work: (repository: PostgresIdentityFoundationRepository) => Promise<T>) =>
    db.transaction().execute((tx) => work(new PostgresIdentityFoundationRepository(tx)));
  const register = (
    subject: string,
    address: string,
    issuer: 'accounts.google.com' | 'https://accounts.google.com' = F.values.canonicalIssuer,
  ) =>
    run(async (repo) => {
      const p = principal(subject, issuer);
      const resolved = await repo.resolveGooglePrincipal(p);
      return resolved.kind === 'resolved'
        ? {
            userId: resolved.userId,
            ...(await repo.initializeLegacyFoundation({
              principal: p,
              userId: resolved.userId,
              email: email(address),
              displayName: F.values.initialName,
              now,
            })),
          }
        : await repo.createGoogleUserFoundation({
            principal: p,
            email: email(address),
            displayName: F.values.initialName,
            now,
          });
    });
  // Encoded storage fixtures; these tests do not claim password verification or Argon2 tuning.
  const hash = F.values.encodedHash;
  try {
    await t.test('opposite issuer aliases converge in concurrent first registration', async () => {
      const results = await Promise.all(
        Array.from({ length: F.configuration.registrationConcurrency }, (_, i) =>
          register(
            F.values.aliasRace,
            F.values.aliasRaceTagExampleTest,
            i % 2 ? F.values.bareIssuer : F.values.canonicalIssuer,
          ),
        ),
      );
      assert.equal(new Set(results.map((r) => r.userId)).size, 1);
      assert.equal(
        (
          await db
            .selectFrom('auth_identities')
            .selectAll()
            .where('subject', '=', F.values.aliasRace)
            .execute()
        ).length,
        1,
      );
      assert.equal(
        (
          await db
            .selectFrom('user_emails')
            .selectAll()
            .where('user_id', '=', results[0]!.userId)
            .execute()
        ).length,
        1,
      );
    });
    await t.test(
      'legacy UUID and organization/nullable-participant references are preserved',
      async () => {
        const p = principal(F.values.legacyVector, F.values.bareIssuer);
        const id = googlePrincipalUserId(p.issuer, p.subject);
        await db.insertInto('users').values({ user_id: id }).execute();
        const org = F.ids.legacyOrganization;
        await db
          .insertInto('organizations')
          .values({
            organization_id: org,
            primary_owner_user_id: id,
            name: F.values.compatibilityFixture,
          })
          .execute();
        const property = F.ids.legacyProperty,
          room = F.ids.legacyRoom,
          tenancy = F.ids.legacyTenancy,
          participant = F.ids.legacyParticipant,
          unregistered = F.ids.legacyUnregisteredParticipant;
        await db
          .insertInto('properties')
          .values({
            property_id: property,
            organization_id: org,
            name: F.values.legacyProperty,
            lifecycle_status: F.values.activeLifecycle,
            operational_address_text: F.values.testFixture,
            operational_location: sql`ST_SetSRID(ST_MakePoint(${F.configuration.longitude},${F.configuration.latitude}),4326)::geography`,
            public_location_projection: sql`ST_SetSRID(ST_MakePoint(${F.configuration.longitude},${F.configuration.latitude}),4326)::geography`,
          })
          .execute();
        await db
          .insertInto('rooms')
          .values({
            room_id: room,
            property_id: property,
            name_or_label: F.values.testRoom,
            operational_state: F.values.vacantRoom,
            record_lifecycle: F.values.activeLifecycle,
          })
          .execute();
        await db
          .insertInto('tenancies')
          .values({
            tenancy_id: tenancy,
            room_id: room,
            status: F.values.draftTenancy,
            started_at: F.states.tenancyStartedAt,
            ended_at: F.states.tenancyEndedAt,
            end_reason: F.states.tenancyEndReason,
          })
          .execute();
        for (const record of [
          { tenancy_participant_id: participant, user_id: id },
          { tenancy_participant_id: unregistered, user_id: F.states.unregisteredUserId },
        ])
          await db
            .insertInto('tenancy_participants')
            .values({
              ...record,
              tenancy_id: tenancy,
              role: F.values.occupantRole,
              joined_at: now,
              left_at: F.states.participantLeftAt,
            })
            .execute();
        const participantsBefore = await db
          .selectFrom('tenancy_participants')
          .selectAll()
          .where('tenancy_id', '=', tenancy)
          .orderBy('tenancy_participant_id')
          .execute();
        const first = await run((repo) => repo.resolveGooglePrincipal(p));
        const alias = await run((repo) => repo.resolveGooglePrincipal(principal(p.subject)));
        assert.deepEqual(first, { kind: 'resolved', userId: id });
        assert.deepEqual(alias, first);
        assert.equal(
          (
            await db
              .selectFrom('organizations')
              .selectAll()
              .where('organization_id', '=', org)
              .executeTakeFirstOrThrow()
          ).primary_owner_user_id,
          id,
        );
        assert.equal(
          (await db.selectFrom('user_profiles').selectAll().where('user_id', '=', id).execute())
            .length,
          0,
        );
        assert.deepEqual(
          await db
            .selectFrom('tenancy_participants')
            .selectAll()
            .where('tenancy_id', '=', tenancy)
            .orderBy('tenancy_participant_id')
            .execute(),
          participantsBefore,
        );
      },
    );
    await t.test('dual legacy candidates and inconsistent mapping fail closed', async () => {
      for (const issuer of [F.values.bareIssuer, F.values.canonicalIssuer])
        await db
          .insertInto('users')
          .values({ user_id: googlePrincipalUserId(issuer, F.values.dualConflict) })
          .execute();
      await assert.rejects(
        run((repo) => repo.resolveGooglePrincipal(principal(F.values.dualConflict))),
        new RegExp(F.errors.legacyConflict),
      );
      const unrelated = F.ids.conflictUser;
      await db.insertInto('users').values({ user_id: unrelated }).execute();
      await db
        .insertInto('auth_identities')
        .values({
          auth_identity_id: F.ids.conflictIdentity,
          user_id: unrelated,
          provider: F.values.googleProvider,
          issuer: F.values.canonicalIssuer,
          subject: F.values.badOwner,
          linked_at: now,
        })
        .execute();
      await assert.rejects(
        run((repo) => repo.resolveGooglePrincipal(principal(F.values.badOwner))),
        new RegExp(F.errors.principalConflict),
      );
    });
    await t.test(
      'case-only duplicate primary key aborts all new-account rows without merging',
      async () => {
        const first = await register(F.values.emailOwner, F.values.ownerNameTagExampleTest);
        await assert.rejects(
          register(F.values.emailCollision, F.values.ownerNameTagExampleTestCaseVariant),
          new RegExp(F.errors.emailConflict),
        );
        assert.equal(
          (
            await db
              .selectFrom('users')
              .selectAll()
              .where(
                'user_id',
                '=',
                googlePrincipalUserId(F.values.canonicalIssuer, F.values.emailCollision),
              )
              .execute()
          ).length,
          0,
        );
        assert.equal(
          (
            await db
              .selectFrom('auth_identities')
              .selectAll()
              .where('subject', '=', F.values.emailCollision)
              .execute()
          ).length,
          0,
        );
        assert.equal(
          (
            await db
              .selectFrom('user_emails')
              .selectAll()
              .where('user_id', '=', first.userId)
              .executeTakeFirstOrThrow()
          ).email_address,
          F.values.ownerNameTagExampleTest,
        );
      },
    );
    await t.test(
      'email CAS releases old address and rejects stale proofs and duplicate targets',
      async () => {
        const a = await register(F.values.emailChange, F.values.beforeExampleTest);
        const b = await register(F.values.emailOther, F.values.occupiedExampleTest);
        await assert.rejects(
          run((repo) =>
            repo.replacePrimaryEmail({
              userId: a.userId,
              expectedEmailId: a.email.userEmailId,
              expectedEmailRevision: F.values.initialRevision,
              target: email(F.values.occupiedExampleTest),
            }),
          ),
          new RegExp(F.errors.emailConflict),
        );
        const changed = await run((repo) =>
          repo.replacePrimaryEmail({
            userId: a.userId,
            expectedEmailId: a.email.userEmailId,
            expectedEmailRevision: F.values.initialRevision,
            target: {
              ...email(F.values.afterExampleTest),
              verificationSource: F.values.otpVerificationSource,
            },
          }),
        );
        assert.equal(changed.emailRevision, F.values.secondRevision);
        assert.equal(changed.userEmailId, a.email.userEmailId);
        assert.equal(
          await run((repo) => repo.findPrimaryLogin(F.values.beforeExampleTest)),
          F.states.missingLookup,
        );
        await assert.rejects(
          run((repo) =>
            repo.validateProofSnapshot({
              userId: a.userId,
              userEmailId: a.email.userEmailId,
              emailRevision: F.values.initialRevision,
              credentialRevision: F.states.absentCredentialRevision,
            }),
          ),
          new RegExp(F.errors.staleState),
        );
        await assert.rejects(
          run((repo) =>
            repo.replacePrimaryEmail({
              userId: a.userId,
              expectedEmailId: a.email.userEmailId,
              expectedEmailRevision: F.values.initialRevision,
              target: email(F.values.thirdExampleTest),
            }),
          ),
          new RegExp(F.errors.staleState),
        );
        const reused = await register(F.values.emailReused, F.values.beforeExampleTestCaseVariant);
        assert.notEqual(reused.userId, a.userId);
        assert.notEqual(b.userId, a.userId);
      },
    );
    await t.test('concurrent email changes have one CAS winner', async () => {
      const a = await register(F.values.emailCasRace, F.values.casOriginalExampleTest);
      const result = await Promise.allSettled(
        [F.values.leftExampleTest, F.values.rightExampleTest].map((address) =>
          run((repo) =>
            repo.replacePrimaryEmail({
              userId: a.userId,
              expectedEmailId: a.email.userEmailId,
              expectedEmailRevision: F.values.initialRevision,
              target: email(address),
            }),
          ),
        ),
      );
      assert.equal(result.filter((r) => r.status === 'fulfilled').length, 1);
      assert.equal(
        (
          await db
            .selectFrom('user_emails')
            .selectAll()
            .where('user_id', '=', a.userId)
            .executeTakeFirstOrThrow()
        ).email_revision,
        F.values.secondRevision,
      );
    });
    await t.test(
      'cross-User email swaps report typed deadlock/conflict and rollback both operations',
      async () => {
        const left = await register(F.values.crossEmailLeftSubject, F.values.crossEmailLeftAddress);
        const right = await register(
          F.values.crossEmailRightSubject,
          F.values.crossEmailRightAddress,
        );
        const barrier = createIdentityTestBarrier({
          participants: F.configuration.barrierParticipants,
          timeoutMs: F.configuration.barrierTimeoutMs,
          timeoutError: new Error(F.errors.barrierTimeout),
        });
        const attempts = await Promise.allSettled(
          [
            [left, right],
            [right, left],
          ].map(([owner, target]) =>
            run(async (repo) => {
              await repo.validateProofSnapshot({
                userId: owner!.userId,
                userEmailId: owner!.email.userEmailId,
                emailRevision: F.values.initialRevision,
                credentialRevision: F.states.absentCredentialRevision,
              });
              await barrier.wait();
              // Opposite multi-User lock order deliberately induces a real PostgreSQL deadlock.
              await repo.validateProofSnapshot({
                userId: target!.userId,
                userEmailId: target!.email.userEmailId,
                emailRevision: F.values.initialRevision,
                credentialRevision: F.states.absentCredentialRevision,
              });
              return repo.replacePrimaryEmail({
                userId: owner!.userId,
                expectedEmailId: owner!.email.userEmailId,
                expectedEmailRevision: F.values.initialRevision,
                target: email(target!.email.address),
              });
            }).catch((error) => {
              barrier.cancel(error);
              throw error;
            }),
          ),
        );
        assert.ok(attempts.every((result) => result.status === 'rejected'));
        assert.ok(
          attempts.some(
            (result) =>
              result.status === 'rejected' && result.reason instanceof PersistenceDeadlock,
          ),
        );
        for (const result of attempts)
          if (result.status === 'rejected')
            assert.ok(
              result.reason instanceof PersistenceDeadlock ||
                new RegExp(F.errors.emailConflict).test(result.reason.message),
            );
        for (const owner of [left, right]) {
          const stored = await run((repo) => repo.findPrimaryLogin(owner.email.normalizedEmail));
          assert.equal(stored!.email.userId, owner.userId);
          assert.equal(stored!.email.emailRevision, F.values.initialRevision);
        }
      },
    );
    await t.test(
      'failed setup cancels its real transaction peer and preserves both email snapshots',
      async () => {
        const owners = [
          await register(F.values.crossEmailLeftSubject, F.values.crossEmailLeftAddress),
          await register(F.values.crossEmailRightSubject, F.values.crossEmailRightAddress),
        ];
        const barrier = createIdentityTestBarrier({
          participants: owners.length,
          timeoutMs: F.configuration.barrierTimeoutMs,
          timeoutError: new Error(F.errors.barrierTimeout),
        });
        const attempts = await Promise.allSettled(
          owners.map((owner, index) =>
            run(async (repo) => {
              await repo.validateProofSnapshot({
                userId: owner.userId,
                userEmailId: owner.email.userEmailId,
                emailRevision: index === 0 ? F.values.staleRevision : F.values.initialRevision,
                credentialRevision: F.states.absentCredentialRevision,
              });
              await barrier.wait();
            }).catch((error) => {
              barrier.cancel(error);
              throw error;
            }),
          ),
        );
        for (const result of attempts) {
          assert.equal(result.status, 'rejected');
          if (result.status === 'rejected')
            assert.match(result.reason.message, new RegExp(F.errors.staleState));
        }
        for (const owner of owners) {
          const current = await run((repo) => repo.findPrimaryLogin(owner.email.normalizedEmail));
          assert.equal(current!.email.emailRevision, F.values.initialRevision);
          assert.equal(current!.email.userId, owner.userId);
        }
      },
    );
    await t.test(
      'profile seed is insert-once and self edit survives later Google initialization',
      async () => {
        const a = await register(F.values.profilePreserve, F.values.profileExampleTest);
        await run((repo) =>
          repo.updateOwnDisplayName({
            userId: a.userId,
            displayName: F.values.userChoice,
            now: later,
          }),
        );
        const next = await run((repo) =>
          repo.initializeLegacyFoundation({
            principal: principal(F.values.profilePreserve),
            userId: a.userId,
            email: email(F.values.providerChangedExampleTest),
            displayName: F.values.providerNewName,
            now: later,
          }),
        );
        assert.equal(next.profile.displayName, F.values.userChoice);
        assert.equal(next.email.address, F.values.profileExampleTest);
        const p = principal(F.values.noName);
        const missing = await run((repo) =>
          repo.createGoogleUserFoundation({
            principal: p,
            email: email(F.values.noNameExampleTest),
            displayName: F.states.missingDisplayName,
            now,
          }),
        );
        assert.equal(
          (
            await run((repo) =>
              repo.initializeProfileIfAbsent({
                userId: missing.userId,
                displayName: F.values.newGoogleName,
                now: later,
              }),
            )
          ).displayName,
          F.states.missingDisplayName,
        );
        assert.equal(
          (
            await run((repo) =>
              repo.updateOwnDisplayName({
                userId: missing.userId,
                displayName: F.values.completedByUser,
                now: later,
              }),
            )
          ).displayName,
          F.values.completedByUser,
        );
      },
    );
    await t.test(
      'concurrent setup/reset/rehash uses monotonic CAS; stale login snapshot rejects',
      async () => {
        const a = await register(F.values.credentialCas, F.values.credentialExampleTest);
        const absentProof = {
          userId: a.userId,
          userEmailId: a.email.userEmailId,
          emailRevision: F.values.initialRevision,
          credentialRevision: F.states.absentCredentialRevision,
        };
        await run((repo) => repo.validateProofSnapshot(absentProof));
        const setup = await Promise.allSettled(
          Array.from({ length: F.configuration.credentialConcurrency }, () =>
            run((repo) =>
              repo.insertPasswordCredential({ userId: a.userId, encodedHash: hash, now }),
            ),
          ),
        );
        assert.equal(setup.filter((r) => r.status === 'fulfilled').length, 1);
        await assert.rejects(
          run((repo) => repo.validateProofSnapshot(absentProof)),
          new RegExp(F.errors.staleState),
        );
        const snapshot = {
          userId: a.userId,
          userEmailId: a.email.userEmailId,
          normalizedEmail: a.email.normalizedEmail,
          emailRevision: F.values.initialRevision,
          credentialRevision: F.values.initialRevision,
        };
        assert.deepEqual(await run((repo) => repo.validateLoginSnapshot(snapshot)), snapshot);
        const reset = await Promise.allSettled(
          [F.values.resetKind, F.values.rehashKind].map((kind) =>
            run((repo) =>
              repo.replacePasswordCredential({
                userId: a.userId,
                expectedRevision: F.values.initialRevision,
                encodedHash: hash,
                kind: kind as 'reset' | 'rehash',
                now: later,
              }),
            ),
          ),
        );
        assert.equal(reset.filter((r) => r.status === 'fulfilled').length, 1);
        await assert.rejects(
          run((repo) => repo.validateLoginSnapshot(snapshot)),
          new RegExp(F.errors.staleState),
        );
        const row = (await run((repo) => repo.findPrimaryLogin(F.values.credentialExampleTest)))!
          .credential!;
        assert.equal(row.credentialRevision, F.values.secondRevision);
        const rehash = await run((repo) =>
          repo.replacePasswordCredential({
            userId: a.userId,
            expectedRevision: F.values.secondRevision,
            encodedHash: hash,
            kind: F.values.rehashKind,
            now: F.values.rehashAt,
          }),
        );
        assert.equal(rehash.credentialRevision, F.values.thirdRevision);
        assert.equal(rehash.passwordChangedAt, row.passwordChangedAt);
      },
    );
    await t.test(
      'injected failure after foundation and sensitive writes rolls back entire transaction',
      async () => {
        await assert.rejects(
          run(async (repo) => {
            await repo.createGoogleUserFoundation({
              principal: principal(F.values.rollbackNew),
              email: email(F.values.rollbackExampleTest),
              displayName: F.states.missingDisplayName,
              now,
            });
            throw new Error(F.errors.auditUnavailable);
          }),
          new RegExp(F.errors.auditUnavailable),
        );
        assert.equal(
          (
            await db
              .selectFrom('users')
              .selectAll()
              .where(
                'user_id',
                '=',
                googlePrincipalUserId(F.values.canonicalIssuer, F.values.rollbackNew),
              )
              .execute()
          ).length,
          0,
        );
        const a = await register(F.values.rollbackExisting, F.values.keptExampleTest);
        await assert.rejects(
          run(async (repo) => {
            await repo.replacePrimaryEmail({
              userId: a.userId,
              expectedEmailId: a.email.userEmailId,
              expectedEmailRevision: F.values.initialRevision,
              target: email(F.values.rolledBackExampleTest),
            });
            throw new Error(F.errors.auditUnavailable);
          }),
          new RegExp(F.errors.auditUnavailable),
        );
        assert.equal(
          (await run((repo) => repo.findPrimaryLogin(F.values.keptExampleTest)))!.email
            .emailRevision,
          F.values.initialRevision,
        );
      },
    );
    await t.test(
      'SQL guards reject identity reassignment, deletes, stale revisions, invalid FK and hash',
      async () => {
        const a = await register(F.values.sqlGuards, F.values.guardsExampleTest);
        await assert.rejects(
          db
            .updateTable('auth_identities')
            .set({ subject: F.values.changed })
            .where('user_id', '=', a.userId)
            .execute(),
          new RegExp(F.errors.immutable),
        );
        await assert.rejects(
          db.deleteFrom('user_emails').where('user_id', '=', a.userId).execute(),
          new RegExp(F.errors.cannotBeDeleted),
        );
        await assert.rejects(
          db
            .updateTable('user_emails')
            .set({ email_revision: F.values.initialRevision })
            .where('user_id', '=', a.userId)
            .execute(),
          new RegExp(F.errors.nextRevision),
        );
        await assert.rejects(
          db
            .insertInto('password_credentials')
            .values({
              user_id: F.ids.missingCredentialUser,
              password_hash: hash,
              credential_revision: F.values.initialRevision,
              created_at: now,
              password_changed_at: now,
            })
            .execute(),
          new RegExp(F.errors.foreignKey),
        );
        await assert.rejects(
          run((repo) =>
            repo.insertPasswordCredential({
              userId: a.userId,
              encodedHash: F.values.plaintextHash,
              now,
            }),
          ),
          new RegExp(F.errors.invalidHash),
        );
      },
    );
    await t.test('stale email state also rejects login after email change', async () => {
      const a = await register(F.values.emailLoginRace, F.values.loginOldExampleTest);
      await run((repo) =>
        repo.insertPasswordCredential({ userId: a.userId, encodedHash: hash, now }),
      );
      const snapshot = {
        userId: a.userId,
        userEmailId: a.email.userEmailId,
        emailRevision: F.values.initialRevision,
        credentialRevision: F.values.initialRevision,
        normalizedEmail: a.email.normalizedEmail,
      };
      await run((repo) =>
        repo.replacePrimaryEmail({
          userId: a.userId,
          expectedEmailId: a.email.userEmailId,
          expectedEmailRevision: F.values.initialRevision,
          target: email(F.values.loginNewExampleTest),
        }),
      );
      await assert.rejects(
        run((repo) => repo.validateLoginSnapshot(snapshot)),
        new RegExp(F.errors.staleState),
      );
    });
    await t.test(
      'transaction manager exposes foundation and rolls back an uncaught typed conflict',
      async () => {
        const manager = new PostgresTransactionManager(db, createRepositorySet);
        await assert.rejects(
          manager.run(async ({ repositories }) => {
            const p = principal(F.values.managerRollback);
            const a = await repositories.identityFoundation.createGoogleUserFoundation({
              principal: p,
              email: email(F.values.managerExampleTest),
              displayName: F.states.missingDisplayName,
              now,
            });
            await repositories.identityFoundation.replacePrimaryEmail({
              userId: a.userId,
              expectedEmailId: a.email.userEmailId,
              expectedEmailRevision: F.values.staleRevision,
              target: email(F.values.neverExampleTest),
            });
          }),
          new RegExp(F.errors.staleState),
        );
        assert.equal(
          (
            await db
              .selectFrom('users')
              .selectAll()
              .where(
                'user_id',
                '=',
                googlePrincipalUserId(F.values.canonicalIssuer, F.values.managerRollback),
              )
              .execute()
          ).length,
          0,
        );
      },
    );
    await t.test(
      'credential setup requires Google binding and rejects invalid hash encoding',
      async () => {
        const id = F.ids.unboundCredentialUser;
        await db.insertInto('users').values({ user_id: id }).execute();
        await assert.rejects(
          run((repo) => repo.insertPasswordCredential({ userId: id, encodedHash: hash, now })),
          new RegExp(F.errors.googleBindingRequired),
        );
        await assert.rejects(
          run((repo) =>
            repo.insertPasswordCredential({
              userId: id,
              encodedHash: F.values.invalidEncodedHash,
              now,
            }),
          ),
          new RegExp(F.errors.invalidHash),
        );
      },
    );
    await t.test(
      'validated login snapshot retains User lock until transaction completes',
      async () => {
        const a = await register(F.values.lockLifetime, F.values.lockLifetimeExampleTest);
        await run((repo) =>
          repo.insertPasswordCredential({ userId: a.userId, encodedHash: hash, now }),
        );
        const snapshot = {
          userId: a.userId,
          userEmailId: a.email.userEmailId,
          normalizedEmail: a.email.normalizedEmail,
          emailRevision: F.values.initialRevision,
          credentialRevision: F.values.initialRevision,
        };
        let release!: () => void;
        const gate = new Promise<void>((resolve) => {
          release = resolve;
        });
        const locked = createIdentityTestBarrier({
          participants: F.configuration.barrierParticipants,
          timeoutMs: F.configuration.barrierTimeoutMs,
          timeoutError: new Error(F.errors.barrierTimeout),
        });
        const validation = run(async (repo) => {
          await repo.validateLoginSnapshot(snapshot);
          await locked.wait();
          await gate;
        }).catch((error) => {
          locked.cancel(error);
          throw error;
        });
        let reset: Promise<void> | undefined;
        let resetCommitted = false;
        try {
          await locked.wait();
          let started!: (pid: number) => void, failed!: (error: unknown) => void;
          const resetStarted = new Promise<number>((resolve, reject) => {
            started = resolve;
            failed = reject;
          });
          reset = db
            .transaction()
            .execute(async (tx) => {
              const result = await sql<{ pid: number }>`SELECT pg_backend_pid() AS pid`.execute(tx);
              started(result.rows[0]!.pid);
              await new PostgresIdentityFoundationRepository(tx).replacePasswordCredential({
                userId: a.userId,
                expectedRevision: F.values.initialRevision,
                encodedHash: hash,
                kind: F.values.resetKind,
                now: later,
              });
            })
            .then(() => {
              resetCommitted = true;
            })
            .catch((error) => {
              failed(error);
              throw error;
            });
          const pid = await resetStarted;
          const deadline = performance.now() + F.configuration.barrierTimeoutMs;
          for (;;) {
            assert.equal(resetCommitted, false);
            const status = await sql<{ blocked: boolean }>`SELECT EXISTS (
              SELECT 1 FROM pg_locks WHERE pid=${pid} AND NOT granted) AS blocked`.execute(db);
            if (status.rows[0]!.blocked) break;
            if (performance.now() >= deadline) throw new Error(F.errors.lockObservationTimeout);
          }
        } finally {
          release();
          await Promise.allSettled([validation, ...(reset ? [reset] : [])]);
        }
        await validation;
        await reset;
        await assert.rejects(
          run((repo) => repo.validateLoginSnapshot(snapshot)),
          new RegExp(F.errors.staleState),
        );
      },
    );
  } finally {
    await db.destroy();
  }
});

test('real schema matches both frozen v1 and the separate vNext physical contracts', async () => {
  await initializeIdentityTestDatabase(process.env.TEST_DATABASE_URL!);
  const client = new Client({ connectionString: process.env.TEST_DATABASE_URL });
  await client.connect();
  try {
    for (const path of [
      'docs/database/v1/erd/physical.json',
      'docs/database/vnext/identity-foundation/physical.json',
    ]) {
      const contract = JSON.parse(readFileSync(path, 'utf8'));
      for (const table of contract.tables) {
        const actual = (
          await client.query(
            "SELECT column_name, data_type, is_nullable, column_default, collation_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position",
            [table.name],
          )
        ).rows;
        assert.deepEqual(
          actual.map((c) => c.column_name),
          table.columns.map((c: { name: string }) => c.name),
          table.name,
        );
        for (const expected of table.columns) {
          const c = actual.find((c) => c.column_name === expected.name)!;
          assert.equal(
            c.is_nullable,
            expected.nullable ? 'YES' : 'NO',
            table.name + '.' + expected.name,
          );
          if (path.includes('vnext')) {
            assert.equal(
              c.data_type,
              expected.type === 'timestamptz' ? 'timestamp with time zone' : expected.type,
            );
            assert.equal(c.column_default, null);
          }
          if (expected.collation) assert.equal(c.collation_name, expected.collation);
        }
        const constraints = (
          await client.query(
            'SELECT conname, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid=$1::regclass',
            ['public.' + table.name],
          )
        ).rows;
        const expectedNames = [
          table.primaryKey.name,
          ...table.checks.map((c: { name: string }) => c.name),
          ...table.uniqueConstraints.map((c: { name: string }) => c.name),
          ...table.columns
            .filter((c: { references?: unknown }) => c.references)
            .map((c: { references: { name: string } }) => c.references.name),
        ].sort();
        assert.deepEqual(
          constraints.map((c) => c.conname).sort(),
          expectedNames,
          table.name + ' constraints',
        );
        const canonical = (value: string) =>
          value
            .replace(/\bIN\s*\(([^()]*)\)/gi, '= ANY (ARRAY[$1])')
            .replace(/::text(?:\[\])?|::bigint|CHECK/gi, '')
            .replace(/[\s()"]/g, '');
        if (path.includes('vnext')) {
          assert.equal(
            constraints.find((c) => c.conname === table.primaryKey.name)!.definition,
            `PRIMARY KEY (${table.primaryKey.columns.join(', ')})`,
          );
          for (const unique of table.uniqueConstraints)
            assert.equal(
              constraints.find((c) => c.conname === unique.name)!.definition,
              `UNIQUE (${unique.columns.join(', ')})`,
            );
          for (const column of table.columns.filter(
            (c: { references?: unknown }) => c.references,
          )) {
            const ref = column.references;
            assert.equal(
              constraints.find((c) => c.conname === ref.name)!.definition,
              `FOREIGN KEY (${column.name}) REFERENCES ${ref.table}(${ref.column})`,
            );
            assert.equal(ref.onDelete, 'NO ACTION');
            assert.equal(ref.onUpdate, 'NO ACTION');
          }
        }
        if (path.includes('vnext'))
          for (const check of table.checks)
            assert.equal(
              canonical(constraints.find((c) => c.conname === check.name)!.definition),
              canonical(check.expression),
              check.name,
            );
        for (const index of table.indexes)
          assert.ok(
            (
              await client.query(
                "SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename=$1 AND indexname=$2",
                [table.name, index.name],
              )
            ).rowCount,
            index.name,
          );
      }
    }
    const triggers = (
      await client.query(
        "SELECT tgname, tgtype, tgenabled, proname FROM pg_trigger JOIN pg_proc ON tgfoid=pg_proc.oid WHERE NOT tgisinternal AND tgrelid IN ('auth_identities'::regclass,'user_emails'::regclass,'password_credentials'::regclass) ORDER BY tgname",
      )
    ).rows;
    assert.deepEqual(
      triggers,
      [
        'tr_auth_identities_immutable',
        'tr_password_credentials_revision',
        'tr_user_emails_revision',
      ].map((tgname) => ({
        tgname,
        tgtype: 27,
        tgenabled: 'O',
        proname: 'identity_foundation_write_guard',
      })),
    );
  } finally {
    await client.end();
  }
});

test('migration chain guard, populated down refusal and empty up/down are safe', async () => {
  const url = process.env.TEST_DATABASE_URL!;
  await initializeIdentityTestDatabase(url);
  const migrationChain = prepareIdentityMigrationChain();
  const db = createDatabaseClient({ url, maxPoolSize: 4, connectionTimeoutMs: 5000 });
  try {
    await db.transaction().execute((tx) =>
      new PostgresIdentityFoundationRepository(tx).createGoogleUserFoundation({
        principal: { issuer: F.values.canonicalIssuer, subject: F.values.rollbackNew },
        email: {
          address: F.values.rollbackExampleTest,
          normalizedEmail: F.values.rollbackExampleTest,
          verificationSource: F.values.googleProvider,
          verifiedAt: F.values.now,
        },
        displayName: F.states.missingDisplayName,
        now: F.values.now,
      }),
    );
  } finally {
    await db.destroy();
  }
  const { runner } = await import('node-pg-migrate');
  const options = {
    databaseUrl: url,
    migrationsTable: 'schema_migrations',
    checkOrder: true,
    log: () => undefined,
  };
  const dir = migrationChain.dir;
  await assert.rejects(
    runner({ ...options, dir, direction: 'down', count: 1 }),
    new RegExp(F.errors.populatedDownRefusal),
  );
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    assert.ok(
      (await client.query("SELECT to_regclass('public.auth_identities') AS relation")).rows[0]
        .relation,
    );
  } finally {
    await client.end();
  }
  // Failed down leaves committed data and migration history intact; forward up is a no-op.
  await runner({ ...options, dir, direction: 'up' });
  const intact = new Client({ connectionString: url });
  await intact.connect();
  try {
    assert.equal(
      (await intact.query('SELECT count(*)::int AS n FROM auth_identities')).rows[0].n,
      1,
    );
    assert.deepEqual(
      (await intact.query('SELECT name FROM schema_migrations ORDER BY id')).rows.map(
        (r) => r.name,
      ),
      migrationChain.names,
    );
  } finally {
    await intact.end();
  }
  await resetPublicSchema(url);
  const incomplete = prepareMissingPredecessorChain();
  try {
    await assert.rejects(
      runner({ ...options, dir: incomplete.dir, direction: 'up' }),
      new RegExp(F.errors.requiresCombinedIntegrationMigrations),
    );
  } finally {
    incomplete.cleanup();
  }
  await resetPublicSchema(url);
  await runner({ ...options, dir, direction: 'up' });
  await runner({ ...options, dir, direction: 'down', count: 1 });
  const empty = new Client({ connectionString: url });
  await empty.connect();
  try {
    assert.equal(
      (await empty.query("SELECT to_regclass('public.auth_identities') AS relation")).rows[0]
        .relation,
      null,
    );
    assert.ok(
      (await empty.query("SELECT to_regclass('public.users') AS relation")).rows[0].relation,
    );
  } finally {
    await empty.end();
  }
  await runner({ ...options, dir, direction: 'up' });
});
