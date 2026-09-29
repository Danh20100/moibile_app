import assert from 'node:assert/strict';
import test from 'node:test';

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OPTIONAL_DEPS_METADATA } from '@nestjs/common/constants';

import type { RoomOperationalTransitionCause } from '../../src/modules/room/contracts';
import { RoomService } from '../../src/modules/room/services/room.service';
import { readRepoFiles } from '../conformance/erd3/support/source';
import { createActiveProperty, createCoreFoundationHarness } from './support/core-foundation.harness';

async function roomFixture() {
  const harness = createCoreFoundationHarness();
  const propertyId = await createActiveProperty(harness);
  return { service: harness.roomService, properties: harness.propertyService, propertyId };
}

test('RoomService declares PropertyService as a required dependency', () => {
  assert.deepEqual(Reflect.getMetadata(OPTIONAL_DEPS_METADATA, RoomService) ?? [], []);
});

test('room creation rejects a missing parent property', async () => {
  const { service } = await roomFixture();
  await assert.rejects(service.create({ propertyId: 'prop_missing', nameOrLabel: '101' }), NotFoundException);
});

test('new room vacant + active', async () => {
  const { service, propertyId } = await roomFixture();
  const room = await service.create({ propertyId, nameOrLabel: '101' });
  assert.equal(room.operationalState, 'vacant');
  assert.equal(room.recordLifecycle, 'active');
});

test('no room-owned rent/basePrice/area/maxOccupants truth', async () => {
  const { service, propertyId } = await roomFixture();
  const room = await service.create({ propertyId, nameOrLabel: '101' });
  assert.equal('basePrice' in room, false);
  assert.equal('rent' in room, false);
  assert.equal('area' in room, false);
  assert.equal('maxOccupants' in room, false);

  const source = readRepoFiles([
    'src/modules/room/contracts/index.ts',
    'src/modules/room/dto/index.ts',
  ]);
  assert.doesNotMatch(source, /\bbasePrice\b|\brent\b|\barea\b|\bmaxOccupants\b/);
});

test('all manual transitions above', async () => {
  const { service, propertyId } = await roomFixture();

  const vacantToMaintenance = await service.create({ propertyId, nameOrLabel: 'A' });
  assert.equal(
    (await service.transitionOperationalState(vacantToMaintenance.id, 'maintenance', 'manual'))
      .operationalState,
    'maintenance',
  );

  const vacantToInactive = await service.create({ propertyId, nameOrLabel: 'B' });
  assert.equal(
    (await service.transitionOperationalState(vacantToInactive.id, 'inactive', 'manual'))
      .operationalState,
    'inactive',
  );

  const maintenanceToVacant = await service.create({ propertyId, nameOrLabel: 'C' });
  await service.transitionOperationalState(maintenanceToVacant.id, 'maintenance', 'manual');
  assert.equal(
    (await service.transitionOperationalState(maintenanceToVacant.id, 'vacant', 'manual'))
      .operationalState,
    'vacant',
  );

  const maintenanceToInactive = await service.create({ propertyId, nameOrLabel: 'D' });
  await service.transitionOperationalState(maintenanceToInactive.id, 'maintenance', 'manual');
  assert.equal(
    (await service.transitionOperationalState(maintenanceToInactive.id, 'inactive', 'manual'))
      .operationalState,
    'inactive',
  );

  const inactiveToVacant = await service.create({ propertyId, nameOrLabel: 'E' });
  await service.transitionOperationalState(inactiveToVacant.id, 'inactive', 'manual');
  assert.equal(
    (await service.transitionOperationalState(inactiveToVacant.id, 'vacant', 'manual'))
      .operationalState,
    'vacant',
  );
});

test('vacant->occupied manual rejected', async () => {
  const { service, propertyId } = await roomFixture();
  const room = await service.create({ propertyId, nameOrLabel: '101' });
  await assert.rejects(
    service.transitionOperationalState(room.id, 'occupied', 'manual'),
    BadRequestException,
  );
});

test('vacant->occupied tenancy_activated accepted', async () => {
  const { service, propertyId } = await roomFixture();
  const room = await service.create({ propertyId, nameOrLabel: '101' });
  const occupied = await service.transitionOperationalState(
    room.id,
    'occupied',
    'tenancy_activated',
  );
  assert.equal(occupied.operationalState, 'occupied');
});

test('occupied->vacant manual rejected', async () => {
  const { service, propertyId } = await roomFixture();
  const room = await service.create({ propertyId, nameOrLabel: '101' });
  await service.transitionOperationalState(room.id, 'occupied', 'tenancy_activated');
  await assert.rejects(
    service.transitionOperationalState(room.id, 'vacant', 'manual'),
    BadRequestException,
  );
});

test('occupied->vacant checkout_confirmed accepted', async () => {
  const { service, propertyId } = await roomFixture();
  const room = await service.create({ propertyId, nameOrLabel: '101' });
  await service.transitionOperationalState(room.id, 'occupied', 'tenancy_activated');
  const vacated = await service.transitionOperationalState(
    room.id,
    'vacant',
    'checkout_confirmed',
  );
  assert.equal(vacated.operationalState, 'vacant');
});

test('occupied->maintenance rejected for every cause', async () => {
  const { service, propertyId } = await roomFixture();
  const causes: RoomOperationalTransitionCause[] = [
    'manual',
    'tenancy_activated',
    'checkout_confirmed',
  ];
  for (const cause of causes) {
    const room = await service.create({ propertyId, nameOrLabel: `m-${cause}` });
    await service.transitionOperationalState(room.id, 'occupied', 'tenancy_activated');
    await assert.rejects(
      service.transitionOperationalState(room.id, 'maintenance', cause),
      BadRequestException,
    );
  }
});

test('occupied->inactive rejected for every cause', async () => {
  const { service, propertyId } = await roomFixture();
  const causes: RoomOperationalTransitionCause[] = [
    'manual',
    'tenancy_activated',
    'checkout_confirmed',
  ];
  for (const cause of causes) {
    const room = await service.create({ propertyId, nameOrLabel: `i-${cause}` });
    await service.transitionOperationalState(room.id, 'occupied', 'tenancy_activated');
    await assert.rejects(
      service.transitionOperationalState(room.id, 'inactive', cause),
      BadRequestException,
    );
  }
});

test('archive not an operational state', async () => {
  const contracts = readRepoFiles(['src/modules/room/contracts/index.ts']);
  const declaration = contracts.match(
    /(?:type|enum)\s+RoomOperationalState[\s\S]*?(?:;|\n\})/i,
  );
  assert.ok(declaration, 'RoomOperationalState declaration must exist');
  assert.doesNotMatch(declaration[0], /archived/i);

  const service = readRepoFiles(['src/modules/room/services/room.service.ts']);
  assert.doesNotMatch(service, /vacant\s*:\s*\[[^\]]*archived/is);
});

test('archive requires inactive', async () => {
  const { service, propertyId } = await roomFixture();
  const room = await service.create({ propertyId, nameOrLabel: '101' });
  await assert.rejects(
    service.archive(room.id, { hasNonTerminalTenancy: false, hasOpenIncident: false }),
    BadRequestException,
  );
});

test('archive blockers enforced', async () => {
  const { service, propertyId } = await roomFixture();
  const room = await service.create({ propertyId, nameOrLabel: '101' });
  await service.transitionOperationalState(room.id, 'inactive', 'manual');

  await assert.rejects(
    service.archive(room.id, { hasNonTerminalTenancy: true, hasOpenIncident: false }),
    BadRequestException,
  );
  await assert.rejects(
    service.archive(room.id, { hasNonTerminalTenancy: false, hasOpenIncident: true }),
    BadRequestException,
  );
});

test('eligible archive sets recordLifecycle archived', async () => {
  const { service, propertyId } = await roomFixture();
  const room = await service.create({ propertyId, nameOrLabel: '101' });
  await service.transitionOperationalState(room.id, 'inactive', 'manual');
  const archived = await service.archive(room.id, {
    hasNonTerminalTenancy: false,
    hasOpenIncident: false,
  });
  assert.equal(archived.recordLifecycle, 'archived');
  assert.equal(archived.operationalState, 'inactive');
});

test('archived room rejects all operational transitions', async () => {
  const { service, propertyId } = await roomFixture();
  const room = await service.create({ propertyId, nameOrLabel: '101' });
  await service.transitionOperationalState(room.id, 'inactive', 'manual');
  await service.archive(room.id, { hasNonTerminalTenancy: false, hasOpenIncident: false });

  await assert.rejects(
    service.transitionOperationalState(room.id, 'vacant', 'manual'),
    BadRequestException,
  );
  await assert.rejects(
    service.transitionOperationalState(room.id, 'occupied', 'tenancy_activated'),
    BadRequestException,
  );
});

test('archived parent blocks create', async () => {
  const { service: rooms, properties, propertyId } = await roomFixture();
  await properties.archive(propertyId, {
    hasNonTerminalTenancy: false,
    hasPublishedListing: false,
    hasOccupiedRoom: false,
    hasNonInactiveOrArchivedRoom: false,
    hasOpenIncident: false,
  });

  await assert.rejects(
    rooms.create({ propertyId, nameOrLabel: '101' }),
    BadRequestException,
  );
});

test('archived parent blocks inactive->vacant', async () => {
  const { service: rooms, properties, propertyId } = await roomFixture();
  const room = await rooms.create({ propertyId, nameOrLabel: '101' });
  await rooms.transitionOperationalState(room.id, 'inactive', 'manual');
  await properties.archive(propertyId, {
    hasNonTerminalTenancy: false,
    hasPublishedListing: false,
    hasOccupiedRoom: false,
    hasNonInactiveOrArchivedRoom: false,
    hasOpenIncident: false,
  });

  await assert.rejects(
    rooms.transitionOperationalState(room.id, 'vacant', 'manual'),
    BadRequestException,
  );
});

test('HTTP cannot impersonate tenancy/check-out causes', () => {
  const roomController = readRepoFiles([
    'src/modules/room/controllers/room.controller.ts',
  ]);
  const lifecycleRoute = readRepoFiles([
    'src/modules/rental-lifecycle/controllers/rental-lifecycle.controller.ts',
    'src/modules/rental-lifecycle/dto/index.ts',
  ]);
  assert.doesNotMatch(roomController, /operational-state/);
  assert.match(lifecycleRoute, /rooms\/:id\/operational-state/);
  assert.match(lifecycleRoute, /transitionRoomManually/);
  assert.doesNotMatch(
    lifecycleRoute,
    /TransitionRoomManuallyDto[\s\S]*tenancy_activated|checkout_confirmed/,
  );
  assert.doesNotMatch(lifecycleRoute, /@IsIn\(\[[^\]]*(tenancy_activated|checkout_confirmed)/);
});
