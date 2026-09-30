import assert from 'node:assert/strict';
import test from 'node:test';

import { readRepoFiles } from './support/source';

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
