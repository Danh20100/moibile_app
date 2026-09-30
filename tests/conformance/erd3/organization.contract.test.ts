import assert from 'node:assert/strict';
import test from 'node:test';

import { readRepoFile } from './support/source';

test('ORGANIZATION contract carries the primary owner reference', () => {
  const source = readRepoFile('src/modules/organization/contracts/index.ts');
  assert.match(source, /primary[_A-Za-z]*owner[_A-Za-z]*user|primaryOwnerUserId/i);
});

test('old OrganizationStatus active inactive archived is not treated as ERD3 source truth', () => {
  const source = readRepoFile('src/modules/organization/contracts/index.ts');
  assert.doesNotMatch(source, /\bOrganizationStatus\b/);
});
