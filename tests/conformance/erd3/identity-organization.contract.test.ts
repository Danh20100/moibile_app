import assert from 'node:assert/strict';
import test from 'node:test';

import { readRepoFile, readRepoFiles } from './support/source';

test('USER contract has no global business role', () => {
  const source = readRepoFiles([
    'src/modules/identity-access/contracts/index.ts',
    'src/modules/identity-access/dto/index.ts',
    'src/modules/identity-access/services/identity-access.service.ts',
    'src/modules/identity-access/controllers/identity-access.controller.ts',
  ]);

  assert.doesNotMatch(source, /\bUserRole\b/);
  assert.doesNotMatch(source, /\brole\??\s*:/);
  assert.doesNotMatch(source, /['"](?:owner|operator|tenant|platform_admin)['"]/);
  assert.doesNotMatch(source, /\bCreateInvitationDto\b|\bAcceptInvitationDto\b/);
  assert.doesNotMatch(source, /identity-access\/invitations|\binvitations\b/);
});

test('ORGANIZATION contract carries the primary owner reference', () => {
  const source = readRepoFile('src/modules/organization/contracts/index.ts');
  assert.match(source, /primary[_A-Za-z]*owner[_A-Za-z]*user|primaryOwnerUserId/i);
});

test('old OrganizationStatus active inactive archived is not treated as ERD3 source truth', () => {
  const source = readRepoFile('src/modules/organization/contracts/index.ts');
  assert.doesNotMatch(source, /\bOrganizationStatus\b/);
});
