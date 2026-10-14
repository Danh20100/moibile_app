import assert from 'node:assert/strict';
import test from 'node:test';

import { BadRequestException } from '@nestjs/common';

import { isNumeric18Scale2NonNegative } from '../../src/common/domain/decimal-string';
import { ListingService } from '../../src/modules/listing/services/listing.service';
import { readRepoFile } from '../conformance/database-v1/support/source';
import { createCoreTestTransactionManager } from './support/in-memory-transaction-manager';

const listingService = () => new ListingService(createCoreTestTransactionManager());

const publicLocationProjection = { latitude: 10.77, longitude: 106.69 };

function draftInput(roomId = 'room-a') {
  return {
    roomId,
    publicTitle: 'Room A',
    publicDescription: 'Public description',
    publicPriceProjection: '3500000.00',
    publicLocationProjection,
  };
}

function event(reasonCode = 'LANDLORD_MANUAL') {
  return {
    reasonCode,
    actorType: 'USER',
    actorUserId: 'user-a',
    trigger: 'COMMAND',
  };
}
test('new local draft uses draft and roomId as its only ownership reference', async () => {
  const service = listingService();
  const listing = await service.createDraft(draftInput());

  assert.equal(listing.status, 'draft');
  assert.equal(listing.roomId, 'room-a');
  assert.equal('propertyId' in listing, false);
});

test('client Listing ID makes a committed draft create safe to retry', async () => {
  const service = listingService();
  const input = { ...draftInput(), id: '8e85110c-d2cf-4f2a-9de2-2046240beeb8' };
  const first = await service.createDraft(input);
  const retry = await service.createDraft(input);
  assert.equal(retry.id, first.id);
  assert.equal((await service.findByRoomId(input.roomId)).length, 1);
  await assert.rejects(service.createDraft({ ...input, roomId: 'other-room' }), BadRequestException);
});

test('ListingProfile declaration removes stale lifecycle and duplicate-history fields', () => {
  const source = readRepoFile('src/modules/listing/contracts/index.ts');
  const declaration = source.match(/interface\s+ListingProfile[\s\S]*?\n}/);
  assert.ok(declaration, 'ListingProfile declaration must exist');
  assert.doesNotMatch(
    declaration[0],
    /\bpropertyId\b|\bhidden\b|\brented\b|\bpublishedAt\b|\bcreatedAt\b|\bupdatedAt\b/,
  );
});

test('Listing local lifecycle follows the frozen transition graph', async () => {
  const service = listingService();
  const listing = await service.createDraft(draftInput());

  assert.equal((await service.transition(listing.id, 'published', event())).status, 'published');
  assert.equal((await service.transition(listing.id, 'unpublished', event())).status, 'unpublished');
  assert.equal((await service.transition(listing.id, 'published', event())).status, 'published');
});
test('draft and unpublished can archive while published cannot', async () => {
  const draftService = listingService();
  const draft = await draftService.createDraft(draftInput('room-draft'));
  assert.equal((await draftService.transition(draft.id, 'archived', event())).status, 'archived');

  const service = listingService();
  const listing = await service.createDraft(draftInput());
  await service.transition(listing.id, 'published', event());
  await assert.rejects(service.transition(listing.id, 'archived', event()), BadRequestException);
  await service.transition(listing.id, 'unpublished', event());
  assert.equal((await service.transition(listing.id, 'archived', event())).status, 'archived');
});

test('archived is terminal and content update rejects', async () => {
  const service = listingService();
  const listing = await service.createDraft(draftInput());
  await service.transition(listing.id, 'archived', event());

  await assert.rejects(service.transition(listing.id, 'published', event()), BadRequestException);
  await assert.rejects(
    service.updateContent(listing.id, { publicTitle: 'Changed title' }),
    BadRequestException,
  );
});

test('at most one current non-archived Listing exists per Room', async () => {
  const service = listingService();
  await service.createDraft(draftInput());
  await assert.rejects(service.createDraft(draftInput()), BadRequestException);
});
test('archived history allows a later current Listing for the same Room', async () => {
  const service = listingService();
  const first = await service.createDraft(draftInput());
  await service.transition(first.id, 'archived', event());

  const second = await service.createDraft(draftInput());
  assert.notEqual(second.id, first.id);
  assert.equal(second.status, 'draft');
});

test('status transitions append immutable ListingStatusEvent history', async () => {
  const service = listingService();
  const listing = await service.createDraft(draftInput());
  await service.transition(listing.id, 'published', event());

  const firstRead = await service.listStatusEvents(listing.id);
  assert.equal(firstRead.length, 1);
  assert.equal(firstRead[0].fromStatus, 'draft');
  assert.equal(firstRead[0].toStatus, 'published');

  firstRead[0].reasonCode = 'MUTATED';
  await service.transition(listing.id, 'unpublished', event('ROOM_MAINTENANCE'));
  const secondRead = await service.listStatusEvents(listing.id);
  assert.equal(secondRead.length, 2);
  assert.equal(secondRead[0].reasonCode, 'LANDLORD_MANUAL');
  assert.equal(secondRead[1].reasonCode, 'ROOM_MAINTENANCE');
});
test('public query returns published public projection only', async () => {
  const service = listingService();
  const listing = await service.createDraft(draftInput());
  assert.deepEqual(await service.findPublished(), []);

  await service.transition(listing.id, 'published', event());
  const [published] = await service.findPublished();
  assert.equal(published.id, listing.id);
  assert.deepEqual(published.publicLocationProjection, publicLocationProjection);
  assert.equal('operationalLocation' in published, false);
  assert.equal('operationalAddressText' in published, false);
});

test('numeric(18,2) exact boundary accepts representable canonical non-negative strings', () => {
  assert.equal(isNumeric18Scale2NonNegative('0'), true);
  assert.equal(isNumeric18Scale2NonNegative('0.00'), true);
  assert.equal(isNumeric18Scale2NonNegative('9999999999999999.99'), true);
});

test('numeric(18,2) exact boundary rejects unsafe or non-canonical values', () => {
  for (const value of [
    '-1',
    '1.234',
    '10000000000000000',
    '01.00',
    '1e3',
    'NaN',
    'Infinity',
    '',
  ]) {
    assert.equal(isNumeric18Scale2NonNegative(value), false, value);
  }
});
