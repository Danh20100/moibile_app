import assert from 'node:assert/strict';
import test from 'node:test';

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OPTIONAL_DEPS_METADATA } from '@nestjs/common/constants';

import type { PropertyArchiveBlockers } from '../../src/modules/property/contracts';
import { CreatePropertyDto, UpdatePropertyDto } from '../../src/modules/property/dto';
import { PropertyService } from '../../src/modules/property/services/property.service';
import { createCoreFoundationHarness, createOrganization } from './support/core-foundation.harness';

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

async function propertyFixture() {
  const harness = createCoreFoundationHarness();
  const organizationId = await createOrganization(harness);
  return {
    service: harness.propertyService,
    harness,
    dto: (overrides: Partial<CreatePropertyDto> = {}) => createDto({ organizationId, ...overrides }),
  };
}

test('PropertyService declares OrganizationService as a required dependency', () => {
  assert.deepEqual(Reflect.getMetadata(OPTIONAL_DEPS_METADATA, PropertyService) ?? [], []);
});

test('property creation rejects a missing parent organization', async () => {
  const { service, dto } = await propertyFixture();
  await assert.rejects(service.create(dto({ organizationId: 'org_missing' })), NotFoundException);
});

test('new property starts active', async () => {
  const { service, dto } = await propertyFixture();
  const created = await service.create(dto());
  assert.equal(created.lifecycleStatus, 'active');
});

test('client property ID makes a committed create safe to retry within its Organization', async () => {
  const { service, dto, harness } = await propertyFixture();
  const request = dto({ id: '6054a932-a213-411f-81a1-6a0eb12d1822' });
  const first = await service.create(request);
  const retry = await service.create(request);
  assert.equal(retry.id, first.id);
  assert.equal((await service.findByOrganizationId(request.organizationId)).length, 1);
  const otherOrganizationId = await createOrganization(harness);
  await assert.rejects(service.create(dto({ id: request.id, organizationId: otherOrganizationId })), BadRequestException);
});

test('operational and public locations are independent', async () => {
  const { service, dto } = await propertyFixture();
  const created = await service.create(dto());
  assert.deepEqual(created.operationalLocation, { latitude: 21.0285, longitude: 105.8542 });
  assert.deepEqual(created.publicLocationProjection, { latitude: 21.03, longitude: 105.85 });
  assert.notDeepEqual(created.operationalLocation, created.publicLocationProjection);
});

test('update public projection does not overwrite operational location', async () => {
  const { service, dto } = await propertyFixture();
  const created = await service.create(dto());
  const updated = await service.update(created.id, {
    publicLocationProjection: { latitude: 21.1, longitude: 105.9 },
  });
  assert.deepEqual(updated.publicLocationProjection, { latitude: 21.1, longitude: 105.9 });
  assert.deepEqual(updated.operationalLocation, created.operationalLocation);
});

test('coordinate validation rejects out-of-range latitude and longitude', async () => {
  const { service, dto } = await propertyFixture();
  await assert.rejects(
    service.create(
      dto({
        operationalLocation: { latitude: 91, longitude: 105 },
      }),
    ),
    BadRequestException,
  );
  await assert.rejects(
    service.create(
      dto({
        publicLocationProjection: { latitude: 21, longitude: 181 },
      }),
    ),
    BadRequestException,
  );
});

test('archive rejects each blocker independently', async () => {
  const { service, dto } = await propertyFixture();
  const blockerKeys: (keyof PropertyArchiveBlockers)[] = [
    'hasNonTerminalTenancy',
    'hasPublishedListing',
    'hasOccupiedRoom',
    'hasNonInactiveOrArchivedRoom',
    'hasOpenIncident',
  ];

  for (const key of blockerKeys) {
    const property = await service.create(dto({ name: `Blocked by ${key}` }));
    await assert.rejects(
      service.archive(property.id, clearBlockers({ [key]: true })),
      BadRequestException,
      `archive must reject when ${key} is true`,
    );
    assert.equal((await service.findById(property.id)).lifecycleStatus, 'active');
  }
});

test('archive succeeds only when all blockers false', async () => {
  const { service, dto } = await propertyFixture();
  const property = await service.create(dto());
  const archived = await service.archive(property.id, clearBlockers());
  assert.equal(archived.lifecycleStatus, 'archived');
});

test('archived is terminal', async () => {
  const { service, dto } = await propertyFixture();
  const property = await service.create(dto());
  await service.archive(property.id, clearBlockers());
  await assert.rejects(service.archive(property.id, clearBlockers()), BadRequestException);
  await assert.rejects(service.update(property.id, { name: 'Changed after archive' }), BadRequestException);
});

test('archived Property rejects edits and cannot be unarchived by an update', async () => {
  const { service, dto } = await propertyFixture();
  const property = await service.create(dto());
  await service.archive(property.id, clearBlockers());

  await assert.rejects(service.update(property.id, {
    name: 'Still archived',
    lifecycleStatus: 'active',
  } as UpdatePropertyDto & { lifecycleStatus?: string }), BadRequestException);
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
