import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { sql } from 'kysely';
import { runMigrations } from '../../../scripts/database/migrate';
import { createDatabaseClient } from '../../../src/infrastructure/database/database.client';
import { PostgresTransactionManager } from '../../../src/infrastructure/database/postgres-transaction-manager';
import { createRepositorySet } from '../../../src/infrastructure/database/repositories/repository-set';
import { IdentityFoundationConflict } from '../../../src/persistence/ports/identity-foundation.repository';
import { resetPublicSchema } from './support/postgres-test-harness';

test('canonical mailbox ownership rejects Google and email-change aliases without merging accounts', async () => {
  const url = process.env.TEST_DATABASE_URL;
  assert.ok(url, 'isolated TEST_DATABASE_URL required');
  await resetPublicSchema(url);
  await runMigrations('up', url);
  const database = createDatabaseClient({
    url,
    maxPoolSize: 8,
    connectionTimeoutMs: 5000,
  });
  const transactions = new PostgresTransactionManager(
    database,
    createRepositorySet,
  );
  const now = new Date().toISOString();
  const email = (
    address: string,
    source: 'google' | 'email_otp' = 'google',
  ) => ({
    address,
    normalizedEmail: address,
    verifiedAt: now,
    verificationSource: source,
  });
  const google = (address: string) =>
    transactions.run(({ repositories }) =>
      repositories.identityFoundation.createGoogleUserFoundation({
        principal: {
          issuer: 'https://accounts.google.com',
          subject: randomUUID(),
        },
        email: email(address),
        displayName: null,
        now,
      }),
    );
  const conflict = (error: unknown) =>
    error instanceof IdentityFoundationConflict &&
    error.code === 'email_conflict';
  try {
    const owner = await transactions.run(({ repositories }) =>
      repositories.identityFoundation.createEmailUserFoundation({
        userId: randomUUID(),
        email: email('owner.name@gmail.com', 'email_otp'),
        encodedHash: '$argon2id$v=19$m=65536,t=3,p=1$c2FsdA$aGFzaA',
        displayName: null,
        now,
      }),
    );
    await assert.rejects(
      () => google('ownername+alias@googlemail.com'),
      conflict,
    );
    const other = await google('other@example.test');
    await assert.rejects(
      () =>
        transactions.run(({ repositories }) =>
          repositories.identityFoundation.replacePrimaryEmail({
            userId: other.userId,
            expectedEmailId: other.email.userEmailId,
            expectedEmailRevision: other.email.emailRevision,
            target: email('ownername+change@gmail.com'),
          }),
        ),
      conflict,
    );
    const unchanged = await transactions.run(({ repositories }) =>
      repositories.identityFoundation.findPrimaryLoginByUserId(other.userId),
    );
    assert.equal(unchanged?.email.normalizedEmail, 'other@example.test');
    const original = await transactions.run(({ repositories }) =>
      repositories.identityFoundation.findMailboxOwner('ownername@gmail.com'),
    );
    assert.equal(original?.userId, owner.userId);
    const outcomes = await Promise.allSettled([
      google('race.name@gmail.com'),
      google('racename+tag@googlemail.com'),
    ]);
    assert.equal(
      outcomes.filter((result) => result.status === 'fulfilled').length,
      1,
    );
    const rejected = outcomes.find((result) => result.status === 'rejected');
    assert.ok(
      rejected && rejected.status === 'rejected' && conflict(rejected.reason),
    );
    // A single owner may change its own spelling without creating a second account.
    const changed = await transactions.run(({ repositories }) =>
      repositories.identityFoundation.replacePrimaryEmail({
        userId: owner.userId,
        expectedEmailId: owner.email.userEmailId,
        expectedEmailRevision: owner.email.emailRevision,
        target: email('ownername+mine@gmail.com', 'email_otp'),
      }),
    );
    assert.equal(changed.userId, owner.userId);

    const migrationSql = (direction: 'up' | 'down') =>
      readFileSync(
        join(
          process.cwd(),
          'database/migrations/sql',
          `000023_canonical_mailbox_ownership.${direction}.sql`,
        ),
        'utf8',
      );
    await sql.raw(migrationSql('down')).execute(database);
    // Model data created before canonical uniqueness existed. Migration must fail
    // without deleting either account or changing the existing spelling.
    await database
      .updateTable('user_emails')
      .set({
        email_address: 'owner.name+legacy@googlemail.com',
        normalized_email: 'owner.name+legacy@googlemail.com',
        email_revision: sql`email_revision + 1`,
      })
      .where('user_id', '=', other.userId)
      .execute();
    await assert.rejects(
      () => sql.raw(migrationSql('up')).execute(database),
      (error: unknown) =>
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === '23505',
    );
    const aliases = await database
      .selectFrom('user_emails')
      .select(['user_id', 'normalized_email'])
      .where('user_id', 'in', [owner.userId, other.userId])
      .execute();
    assert.equal(aliases.length, 2);
    assert.equal(
      aliases.find((row) => row.user_id === other.userId)?.normalized_email,
      'owner.name+legacy@googlemail.com',
    );
    await database
      .updateTable('user_emails')
      .set({
        email_address: 'other@example.test',
        normalized_email: 'other@example.test',
        email_revision: sql`email_revision + 1`,
      })
      .where('user_id', '=', other.userId)
      .execute();
    await sql.raw(migrationSql('up')).execute(database);
    await sql.raw(migrationSql('down')).execute(database);
    await sql.raw(migrationSql('up')).execute(database);
    await assert.rejects(
      () =>
        database
          .updateTable('user_emails')
          .set({
            email_address: 'ownername@gmail.com',
            normalized_email: 'ownername@gmail.com',
            email_revision: sql`email_revision + 1`,
          })
          .where('user_id', '=', other.userId)
          .execute(),
      (error: unknown) =>
        typeof error === 'object' &&
        error !== null &&
        'constraint' in error &&
        error.constraint === 'uq_user_emails_canonical_mailbox',
    );
  } finally {
    await database.destroy();
  }
});
