import assert from 'node:assert/strict';
import test from 'node:test';

import { BadRequestException } from '@nestjs/common';

import type { PropertyArchiveBlockers } from '../../src/modules/property/contracts';
import { CreatePropertyDto, UpdatePropertyDto } from '../../src/modules/property/dto';
import { PropertyService } from '../../src/modules/property/services/property.service';

function createDto(overrides: Partial<CreatePropertyDto> = {}): CreatePropertyDto {
  return {
    organizationId: 'org_1',
    name: 'Nha tro Cau Giay',
    operationalAddressText: 'So 12, Ngo 80 Cau Giay',
    operationalLocation: { latitude: 21.0285, longitude: 105.8542 },
    publicLocationProjection: { latitude: 21.03, longitude: 105.85 },
    ...overrides,
  };
}

function clearBlockers(overrides: Partial<PropertyArchiveBlockers> = {}): PropertyArchiveBlockers {
  return {
    hasNonTerminalTenancy: false,
    hasPublishedListing: false,
    hasOccupiedRoom: false,
    hasNonInactiveOrArchivedRoom: false,
    hasOpenIncident: false,
    ...overrides,
  };
}

test('new property starts active', async () => {
  const service = new PropertyService();
  const created = await service.create(createDto());
  assert.equal(created.lifecycleStatus, 'active');
});

test('operational and public locations are independent', async () => {
  const service = new PropertyService();
  const created = await service.create(createDto());
  assert.deepEqual(created.operationalLocation, { latitude: 21.0285, longitude: 105.8542 });
  assert.deepEqual(created.publicLocationProjection, { latitude: 21.03, longitude: 105.85 });
  assert.notDeepEqual(created.operationalLocation, created.publicLocationProjection);
});

test('update public projection does not overwrite operational location', async () => {
  const service = new PropertyService();
  const created = await service.create(createDto());
  const updated = await service.update(created.id, {
    publicLocationProjection: { latitude: 21.1, longitude: 105.9 },
  });
  assert.deepEqual(updated.publicLocationProjection, { latitude: 21.1, longitude: 105.9 });
  assert.deepEqual(updated.operationalLocation, created.operationalLocation);
});

test('coordinate validation rejects out-of-range latitude and longitude', async () => {
  const service = new PropertyService();
  await assert.rejects(
    service.create(
      createDto({
        operationalLocation: { latitude: 91, longitude: 105 },
      }),
    ),
    BadRequestException,
  );
  await assert.rejects(
    service.create(
      createDto({
        publicLocationProjection: { latitude: 21, longitude: 181 },
      }),
    ),
    BadRequestException,
  );
});

test('archive rejects each blocker independently', async () => {
  const service = new PropertyService();
  const blockerKeys: (keyof PropertyArchiveBlockers)[] = [
    'hasNonTerminalTenancy',
    'hasPublishedListing',
    'hasOccupiedRoom',
    'hasNonInactiveOrArchivedRoom',
    'hasOpenIncident',
  ];

  for (const key of blockerKeys) {
    const property = await service.create(createDto({ name: `Blocked by ${key}` }));
    await assert.rejects(
      service.archive(property.id, clearBlockers({ [key]: true })),
      BadRequestException,
      `archive must reject when ${key} is true`,
    );
    assert.equal((await service.findById(property.id)).lifecycleStatus, 'active');
  }
});

test('archive succeeds only when all blockers false', async () => {
  const service = new PropertyService();
  const property = await service.create(createDto());
  const archived = await service.archive(property.id, clearBlockers());
  assert.equal(archived.lifecycleStatus, 'archived');
});

test('archived is terminal', async () => {
  const service = new PropertyService();
  const property = await service.create(createDto());
  await service.archive(property.id, clearBlockers());
  await assert.rejects(service.archive(property.id, clearBlockers()), BadRequestException);
});

test('update cannot change lifecycle/unarchive', async () => {
  const service = new PropertyService();
  const property = await service.create(createDto());
  await service.archive(property.id, clearBlockers());

  const updated = await service.update(property.id, {
    name: 'Still archived',
    lifecycleStatus: 'active',
  } as UpdatePropertyDto & { lifecycleStatus?: string });

  assert.equal(updated.name, 'Still archived');
  assert.equal(updated.lifecycleStatus, 'archived');
});

test('client DTO contains no archive-blocker truth fields', () => {
  const create = createDto();
  const update: UpdatePropertyDto = {
    name: 'Updated',
    operationalAddressText: 'New address',
  };
  for (const key of [
    'hasNonTerminalTenancy',
    'hasPublishedListing',
    'hasOccupiedRoom',
    'hasNonInactiveOrArchivedRoom',
    'hasOpenIncident',
  ]) {
    assert.equal(key in create, false);
    assert.equal(key in update, false);
  }
});
