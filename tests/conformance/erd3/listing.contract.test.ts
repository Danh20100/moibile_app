import assert from 'node:assert/strict';
import test from 'node:test';

import { readRepoFile, readRepoFiles } from './support/source';

test('LISTING lifecycle is DRAFT PUBLISHED UNPUBLISHED ARCHIVED only', () => {
  const source = readRepoFile('src/modules/listing/contracts/index.ts');
  for (const state of ['draft', 'published', 'unpublished', 'archived']) {
    assert.match(source, new RegExp(`['\"]${state}['\"]`, 'i'), `missing Listing state ${state}`);
  }
  assert.doesNotMatch(source, /['"]hidden['"]|['"]rented['"]/i);
});

test('LISTING no longer uses hidden or rented states', () => {
  const source = readRepoFiles([
    'src/modules/listing/contracts/index.ts',
    'src/modules/listing/services/listing.service.ts',
    'src/modules/listing/dto/index.ts',
  ]);
  assert.doesNotMatch(source, /['"]hidden['"]|['"]rented['"]/i);
});

test('LISTING does not duplicate Property ownership beside Room ownership', () => {
  const source = readRepoFiles([
    'src/modules/listing/contracts/index.ts',
    'src/modules/listing/dto/index.ts',
  ]);
  assert.doesNotMatch(source, /\bpropertyId\b/);
  assert.match(source, /\broomId\b/);
});

test('publishing is coupled to Room vacancy and active Property eligibility', () => {
  const source = readRepoFile(
    'src/modules/rental-lifecycle/services/rental-lifecycle.coordinator.ts',
  ).toLowerCase();
  assert.ok(source.includes('vacant'), 'publish workflow must check Room VACANT');
  assert.ok(source.includes('active'), 'publish workflow must check active Room/Property lifecycle');
});

test('Room leaving VACANT has an explicit synchronous unpublish workflow', () => {
  const source = readRepoFile(
    'src/modules/rental-lifecycle/services/rental-lifecycle.coordinator.ts',
  ).toLowerCase();
  assert.ok(source.includes('unpublish'), 'Room/listing orchestration must expose an unpublish workflow');
  assert.ok(source.includes('vacant'), 'unpublish workflow must be coupled to Room VACANT semantics');
});

test('Room has at most one current non-archived Listing', () => {
  const source = readRepoFiles([
    'src/modules/listing/services/listing.service.ts',
    'src/modules/listing/contracts/index.ts',
  ]).toLowerCase();
  assert.ok(
    source.includes('non-archived') || source.includes('nonarchived') || source.includes('current listing') || source.includes('currentlisting'),
    'listing implementation must expose the single-current-listing invariant',
  );
});

test('listing status change has a first-class event history concept', () => {
  const source = readRepoFiles([
    'src/modules/listing/contracts/index.ts',
    'src/modules/listing/services/listing.service.ts',
  ]);
  assert.match(source, /ListingStatusEvent|listing_status_event/i);
});
