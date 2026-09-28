import assert from 'node:assert/strict';
import test from 'node:test';

import { BadRequestException } from '@nestjs/common';

import type { RoomOperationalTransitionCause } from '../../src/modules/room/contracts';
import { RoomService } from '../../src/modules/room/services/room.service';
import { PropertyService } from '../../src/modules/property/services/property.service';
import { readRepoFiles } from '../conformance/erd3/support/source';

async function createActiveProperty(properties: PropertyService): Promise<string> {
  const property = await properties.create({
    organizationId: 'org_1',
    name: 'Property A',
    operationalAddressText: 'Address A',
    operationalLocation: { latitude: 21.0, longitude: 105.0 },
    publicLocationProjection: { latitude: 21.0, longitude: 105.0 },
  });
  return property.id;
}

test('new room vacant + active', async () => {
  const service = new RoomService();
  const room = await service.create({ propertyId: 'prop_1', nameOrLabel: '101' });
  assert.equal(room.operationalState, 'vacant');
  assert.equal(room.recordLifecycle, 'active');
});

test('no room-owned rent/basePrice/area/maxOccupants truth', async () => {
  const service = new RoomService();
  const room = await service.create({ propertyId: 'prop_1', nameOrLabel: '101' });
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
  const service = new RoomService();

  const vacantToMaintenance = await service.create({ propertyId: 'prop_1', nameOrLabel: 'A' });
  assert.equal(
    (await service.transitionOperationalState(vacantToMaintenance.id, 'maintenance', 'manual'))
      .operationalState,
    'maintenance',
  );

  const vacantToInactive = await service.create({ propertyId: 'prop_1', nameOrLabel: 'B' });
  assert.equal(
    (await service.transitionOperationalState(vacantToInactive.id, 'inactive', 'manual'))
      .operationalState,
    'inactive',
  );

  const maintenanceToVacant = await service.create({ propertyId: 'prop_1', nameOrLabel: 'C' });
  await service.transitionOperationalState(maintenanceToVacant.id, 'maintenance', 'manual');
  assert.equal(
    (await service.transitionOperationalState(maintenanceToVacant.id, 'vacant', 'manual'))
      .operationalState,
    'vacant',
  );

  const maintenanceToInactive = await service.create({ propertyId: 'prop_1', nameOrLabel: 'D' });
  await service.transitionOperationalState(maintenanceToInactive.id, 'maintenance', 'manual');
  assert.equal(
    (await service.transitionOperationalState(maintenanceToInactive.id, 'inactive', 'manual'))
      .operationalState,
    'inactive',
  );

  const inactiveToVacant = await service.create({ propertyId: 'prop_1', nameOrLabel: 'E' });
  await service.transitionOperationalState(inactiveToVacant.id, 'inactive', 'manual');
  assert.equal(
    (await service.transitionOperationalState(inactiveToVacant.id, 'vacant', 'manual'))
      .operationalState,
    'vacant',
  );
});

test('vacant->occupied manual rejected', async () => {
  const service = new RoomService();
  const room = await service.create({ propertyId: 'prop_1', nameOrLabel: '101' });
  await assert.rejects(
    service.transitionOperationalState(room.id, 'occupied', 'manual'),
    BadRequestException,
  );
});

test('vacant->occupied tenancy_activated accepted', async () => {
  const service = new RoomService();
  const room = await service.create({ propertyId: 'prop_1', nameOrLabel: '101' });
  const occupied = await service.transitionOperationalState(
    room.id,
    'occupied',
    'tenancy_activated',
  );
  assert.equal(occupied.operationalState, 'occupied');
});

test('occupied->vacant manual rejected', async () => {
  const service = new RoomService();
  const room = await service.create({ propertyId: 'prop_1', nameOrLabel: '101' });
  await service.transitionOperationalState(room.id, 'occupied', 'tenancy_activated');
  await assert.rejects(
    service.transitionOperationalState(room.id, 'vacant', 'manual'),
    BadRequestException,
  );
});

test('occupied->vacant checkout_confirmed accepted', async () => {
  const service = new RoomService();
  const room = await service.create({ propertyId: 'prop_1', nameOrLabel: '101' });
  await service.transitionOperationalState(room.id, 'occupied', 'tenancy_activated');
  const vacated = await service.transitionOperationalState(
    room.id,
    'vacant',
    'checkout_confirmed',
  );
  assert.equal(vacated.operationalState, 'vacant');
});

test('occupied->maintenance rejected for every cause', async () => {
  const service = new RoomService();
  const causes: RoomOperationalTransitionCause[] = [
    'manual',
    'tenancy_activated',
    'checkout_confirmed',
  ];
  for (const cause of causes) {
    const room = await service.create({ propertyId: 'prop_1', nameOrLabel: `m-${cause}` });
    await service.transitionOperationalState(room.id, 'occupied', 'tenancy_activated');
    await assert.rejects(
      service.transitionOperationalState(room.id, 'maintenance', cause),
      BadRequestException,
    );
  }
});

test('occupied->inactive rejected for every cause', async () => {
  const service = new RoomService();
  const causes: RoomOperationalTransitionCause[] = [
    'manual',
    'tenancy_activated',
    'checkout_confirmed',
  ];
  for (const cause of causes) {
    const room = await service.create({ propertyId: 'prop_1', nameOrLabel: `i-${cause}` });
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
  const service = new RoomService();
  const room = await service.create({ propertyId: 'prop_1', nameOrLabel: '101' });
  await assert.rejects(
    service.archive(room.id, { hasNonTerminalTenancy: false, hasOpenIncident: false }),
    BadRequestException,
  );
});

test('archive blockers enforced', async () => {
  const service = new RoomService();
  const room = await service.create({ propertyId: 'prop_1', nameOrLabel: '101' });
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
  const service = new RoomService();
  const room = await service.create({ propertyId: 'prop_1', nameOrLabel: '101' });
  await service.transitionOperationalState(room.id, 'inactive', 'manual');
  const archived = await service.archive(room.id, {
    hasNonTerminalTenancy: false,
    hasOpenIncident: false,
  });
  assert.equal(archived.recordLifecycle, 'archived');
  assert.equal(archived.operationalState, 'inactive');
});

test('archived room rejects all operational transitions', async () => {
  const service = new RoomService();
  const room = await service.create({ propertyId: 'prop_1', nameOrLabel: '101' });
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
  const properties = new PropertyService();
  const rooms = new RoomService(properties);
  const propertyId = await createActiveProperty(properties);
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
  const properties = new PropertyService();
  const rooms = new RoomService(properties);
  const propertyId = await createActiveProperty(properties);
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
  const controller = readRepoFiles([
    'src/modules/room/controllers/room.controller.ts',
    'src/modules/room/dto/index.ts',
  ]);
  assert.match(controller, /operational-state/);
  assert.match(controller, /'cause'|\"manual\"|'manual'/);
  assert.doesNotMatch(
    controller,
    /UpdateRoomOperationalStateDto[\s\S]*tenancy_activated|checkout_confirmed/,
  );
  assert.doesNotMatch(controller, /@IsIn\(\[[^\]]*(tenancy_activated|checkout_confirmed)/);
});
