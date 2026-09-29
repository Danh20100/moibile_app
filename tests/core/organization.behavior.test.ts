import assert from 'node:assert/strict';
import test from 'node:test';

import { OrganizationService } from '../../src/modules/organization/services/organization.service';
import { createCoreTestTransactionManager } from './support/in-memory-transaction-manager';

test('create stores primaryOwnerUserId', async () => {
  const service = new OrganizationService(createCoreTestTransactionManager());
  const created = await service.create({
    name: 'An Cu Rental Workspace',
    primaryOwnerUserId: 'user_owner_1',
  });

  assert.equal(created.primaryOwnerUserId, 'user_owner_1');
  assert.equal(created.name, 'An Cu Rental Workspace');
});

test('update can rename', async () => {
  const service = new OrganizationService(createCoreTestTransactionManager());
  const created = await service.create({
    name: 'Original Name',
    primaryOwnerUserId: 'user_owner_1',
  });

  const updated = await service.update(created.id, { name: 'Renamed Workspace' });
  assert.equal(updated.name, 'Renamed Workspace');
  assert.equal(updated.primaryOwnerUserId, 'user_owner_1');
});

test('untyped extra primaryOwnerUserId cannot replace owner', async () => {
  const service = new OrganizationService(createCoreTestTransactionManager());
  const created = await service.create({
    name: 'Owned Workspace',
    primaryOwnerUserId: 'user_owner_1',
  });

  const updated = await service.update(created.id, {
    name: 'Still Owned',
    primaryOwnerUserId: 'user_attacker',
  } as { name?: string });

  assert.equal(updated.primaryOwnerUserId, 'user_owner_1');
  assert.equal(updated.name, 'Still Owned');
});

test('returned profile has no status', async () => {
  const service = new OrganizationService(createCoreTestTransactionManager());
  const created = await service.create({
    name: 'Workspace',
    primaryOwnerUserId: 'user_owner_1',
  });

  assert.equal('status' in created, false);
});

test('returned profile has no description', async () => {
  const service = new OrganizationService(createCoreTestTransactionManager());
  const created = await service.create({
    name: 'Workspace',
    primaryOwnerUserId: 'user_owner_1',
  });

  assert.equal('description' in created, false);
});

test('still-valid list/find engineering behavior remains intact', async () => {
  const service = new OrganizationService(createCoreTestTransactionManager());
  const first = await service.create({
    name: 'Workspace A',
    primaryOwnerUserId: 'user_a',
  });
  const second = await service.create({
    name: 'Workspace B',
    primaryOwnerUserId: 'user_b',
  });

  const listed = await service.findAll();
  assert.equal(listed.length, 2);
  assert.equal((await service.findById(first.id)).id, first.id);
  assert.equal((await service.findById(second.id)).name, 'Workspace B');
});
