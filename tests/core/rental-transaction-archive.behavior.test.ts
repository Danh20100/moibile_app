import assert from 'node:assert/strict';
import test from 'node:test';

import { RentalTransactionCoordinator } from '../../src/persistence/guards/rental-transaction-coordinator';
import { TenancyService } from '../../src/modules/tenancy/services/tenancy.service';
import { createActiveProperty, createCoreFoundationHarness } from './support/core-foundation.harness';

test('Room archive is atomic and fails closed when any Tenancy history exists', async () => {
  const harness = createCoreFoundationHarness();
  const propertyId = await createActiveProperty(harness);
  const room = await harness.roomService.create({ propertyId, nameOrLabel: '201' });
  const tenancies = new TenancyService(harness.transactions);
  await tenancies.createDraft(room.id);
  await harness.roomService.transitionOperationalState(room.id, 'inactive', 'manual');

  const lifecycle = new RentalTransactionCoordinator(harness.transactions);
  await assert.rejects(lifecycle.archiveRoom(room.id), /Tenancy or incident history/);
  assert.equal((await harness.roomService.findById(room.id)).recordLifecycle, 'active');
});

test('eligible Room archive writes a lifecycle tombstone without deleting its Property', async () => {
  const harness = createCoreFoundationHarness();
  const propertyId = await createActiveProperty(harness);
  const room = await harness.roomService.create({ propertyId, nameOrLabel: '202' });
  await harness.roomService.transitionOperationalState(room.id, 'inactive', 'manual');

  await new RentalTransactionCoordinator(harness.transactions).archiveRoom(room.id);
  assert.equal((await harness.roomService.findById(room.id)).recordLifecycle, 'archived');
  assert.equal((await harness.propertyService.findById(propertyId)).lifecycleStatus, 'active');
});
