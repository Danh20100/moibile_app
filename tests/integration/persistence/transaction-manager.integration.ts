import assert from 'node:assert/strict';
import test from 'node:test';
import type { Transaction } from 'kysely';

import { runMigrations } from '../../../scripts/database/migrate';
import { createDatabaseClient } from '../../../src/infrastructure/database/database.client';
import { PostgresTransactionManager } from '../../../src/infrastructure/database/postgres-transaction-manager';
import type { RepositorySetFactory } from '../../../src/infrastructure/database/repositories/repository-set';
import type { Database } from '../../../src/infrastructure/database/schema.types';
import type { PersistenceRepositories } from '../../../src/persistence/ports/transaction-manager';
import { resetPublicSchema } from './support/postgres-test-harness';

const userIds = {
  committed: '00000000-0000-4000-8000-000000000001',
  rolledBack: '00000000-0000-4000-8000-000000000002',
  effectFailure: '00000000-0000-4000-8000-000000000003',
  concurrentOne: '00000000-0000-4000-8000-000000000004',
  concurrentTwo: '00000000-0000-4000-8000-000000000005',
};

async function transactionHarness() {
  const databaseUrl = process.env.TEST_DATABASE_URL;
  assert.ok(databaseUrl, 'TEST_DATABASE_URL is required for transaction integration');
  await resetPublicSchema(databaseUrl);
  await runMigrations('up', databaseUrl);
  const database = createDatabaseClient({ url: databaseUrl, maxPoolSize: 4, connectionTimeoutMs: 5000 });
  const executors = new Set<Transaction<Database>>();
  const factory: RepositorySetFactory = (executor) => {
    executors.add(executor);
    return {
      identity: {
        insertUser: async (userId) => {
          await executor.insertInto('users').values({ user_id: userId }).execute();
        },
        userExists: async (userId) =>
          (await executor.selectFrom('users').select('user_id').where('user_id', '=', userId).executeTakeFirst()) !== undefined,
      },
    } as PersistenceRepositories;
  };
  const userExists = async (userId: string) =>
    (await database.selectFrom('users').select('user_id').where('user_id', '=', userId).executeTakeFirst()) !== undefined;
  return { database, executors, manager: new PostgresTransactionManager(database, factory), userExists };
}

test('commits successful work and then runs afterCommit', async () => {
  const harness = await transactionHarness();
  try {
    let visibleAfterCommit = false;
    const result = await harness.manager.run(async ({ repositories, afterCommit }) => {
      await repositories.identity.insertUser(userIds.committed);
      afterCommit(async () => { visibleAfterCommit = await harness.userExists(userIds.committed); });
      return 'business-result';
    });
    assert.equal(result, 'business-result');
    assert.equal(await harness.userExists(userIds.committed), true);
    assert.equal(visibleAfterCommit, true);
  } finally { await harness.database.destroy(); }
});

test('rolls back thrown work and does not run afterCommit or retry', async () => {
  const harness = await transactionHarness();
  try {
    let attempts = 0;
    let effects = 0;
    await assert.rejects(harness.manager.run(async ({ repositories, afterCommit }) => {
      attempts += 1;
      await repositories.identity.insertUser(userIds.rolledBack);
      afterCommit(() => { effects += 1; });
      throw new Error('work failed');
    }), /work failed/);
    assert.equal(attempts, 1);
    assert.equal(effects, 0);
    assert.equal(await harness.userExists(userIds.rolledBack), false);
  } finally { await harness.database.destroy(); }
});

test('routes afterCommit failures without changing the committed result', async () => {
  const harness = await transactionHarness();
  try {
    const failures: unknown[] = [];
    const result = await harness.manager.run(async ({ repositories, afterCommit }) => {
      await repositories.identity.insertUser(userIds.effectFailure);
      afterCommit(() => { throw new Error('effect failed'); }, (error) => failures.push(error));
      return 42;
    });
    assert.equal(result, 42);
    assert.equal(await harness.userExists(userIds.effectFailure), true);
    assert.equal((failures[0] as Error).message, 'effect failed');
  } finally { await harness.database.destroy(); }
});

test('concurrent manager calls receive independent transactions', async () => {
  const harness = await transactionHarness();
  try {
    await Promise.all([
      harness.manager.run(({ repositories }) => repositories.identity.insertUser(userIds.concurrentOne)),
      harness.manager.run(({ repositories }) => repositories.identity.insertUser(userIds.concurrentTwo)),
    ]);
    assert.equal(harness.executors.size, 2);
    assert.equal(await harness.userExists(userIds.concurrentOne), true);
    assert.equal(await harness.userExists(userIds.concurrentTwo), true);
  } finally { await harness.database.destroy(); }
});
