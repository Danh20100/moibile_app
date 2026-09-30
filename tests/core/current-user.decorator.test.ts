import assert from 'node:assert/strict';
import test from 'node:test';

import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';

import { requireCurrentUser } from '../../src/common/decorators/current-user.decorator';
import type { VerifiedPrincipal } from '../../src/modules/identity-access/contracts';

function contextWithUser(user?: VerifiedPrincipal): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

test('requireCurrentUser rejects missing verified principal', () => {
  assert.throws(
    () => requireCurrentUser(contextWithUser()),
    (err: unknown) => err instanceof UnauthorizedException,
  );
});

test('requireCurrentUser returns verified principal from request context', () => {
  const principal: VerifiedPrincipal = {
    userId: 'user-1',
    provider: 'google',
    issuer: 'https://accounts.google.com',
    subject: 'sub-1',
  };
  assert.equal(requireCurrentUser(contextWithUser(principal)), principal);
});
