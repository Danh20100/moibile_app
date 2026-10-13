import assert from 'node:assert/strict';
import test from 'node:test';
import type { VerifiedPrincipal } from '../../../src/modules/identity-access/contracts';
import { IdentityAccessController } from '../../../src/modules/identity-access/controllers/identity-access.controller';
import { IdentityAccessService } from '../../../src/modules/identity-access/services/identity-access.service';
import { createDatabaseClient } from '../../../src/infrastructure/database/database.client';
import { PostgresTransactionManager } from '../../../src/infrastructure/database/postgres-transaction-manager';
import { createRepositorySet } from '../../../src/infrastructure/database/repositories/repository-set';
import { loadGooglePrincipals, loadPersistenceScenarios } from '../../support/identity-fixtures';
import { rentalFixture } from './support/identity-legacy-fixture';

test('own Profile HTTP boundary persists across database reconnect and new Google claims', async () => {
  const url = process.env.TEST_DATABASE_URL;
  assert.ok(url, 'TEST_DATABASE_URL is required');
  const fixture = await rentalFixture(url);
  const G = loadGooglePrincipals();
  const F = loadPersistenceScenarios();
  const principal: VerifiedPrincipal = {
    userId: G.userFirst, provider: F.values.googleProvider,
    issuer: F.values.canonicalIssuer, subject: G.subjectFirst,
    email: G.mockEmail, name: F.values.initialName,
  };
  try {
    await fixture.manager.run(async ({ repositories }) => {
      await repositories.identity.ensureUser(G.userFirst);
      await repositories.identity.ensureUser(G.userSecond);
    });
    const controller = new IdentityAccessController(new IdentityAccessService(fixture.manager));
    await assert.rejects(() => controller.getOwnProfile(undefined));
    await assert.rejects(() => controller.updateOwnProfile(undefined, { displayName: F.values.userChoice }));
    await controller.getOwnProfile({ ...principal, userId: G.userSecond });
    await controller.updateOwnProfile(principal, { displayName: F.values.userChoice });
    assert.equal((await controller.getOwnProfile({ ...principal, userId: G.userSecond })).displayName, F.values.initialName);
  } finally {
    await fixture.db.destroy();
  }
  const db = createDatabaseClient({ url, maxPoolSize: 2, connectionTimeoutMs: 5000 });
  try {
    const service = new IdentityAccessService(new PostgresTransactionManager(db, createRepositorySet));
    assert.equal((await service.getSessionContext({ ...principal, name: F.values.providerNewName })).name, F.values.userChoice);
  } finally {
    await db.destroy();
  }
});
