import assert from 'node:assert/strict';
import test from 'node:test';

import { readRepoFile, readRepoFiles } from './support/source';

test('TrustReport target is exactly Listing or Review', () => {
  const source = readRepoFiles([
    'src/modules/audit-trust/contracts/index.ts',
    'src/modules/audit-trust/dto/index.ts',
  ]);

  const hasFrozenTarget =
    /listingId|listing_id/i.test(source) && /reviewId|review_id/i.test(source);
  const hasFrozenUnion = /['"]listing['"]\s*\|\s*['"]review['"]|['"]review['"]\s*\|\s*['"]listing['"]/i.test(source);

  assert.ok(hasFrozenTarget || hasFrozenUnion, 'TrustReport must target Listing or Review only');
  assert.doesNotMatch(source, /user\s*\/\s*property\s*\/\s*receipt|user.*property.*receipt/is);
});

test('TrustReport is distinct from Incident', () => {
  const source = readRepoFiles([
    'src/modules/audit-trust/contracts/index.ts',
    'src/modules/audit-trust/dto/index.ts',
  ]);
  assert.doesNotMatch(source, /incidentId|targetType[^\n]*incident/i);
});

test('trust review source does not expose a public personal landlord rating contract', () => {
  const source = readRepoFiles([
    'src/modules/audit-trust/contracts/index.ts',
    'src/modules/audit-trust/dto/index.ts',
  ]);
  assert.doesNotMatch(source, /landlordRating|ownerRating|userRating|publicUserScore/i);
});
