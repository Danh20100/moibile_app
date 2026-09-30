import assert from 'node:assert/strict';
import test from 'node:test';

import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AuthGuard } from '../../src/common/guards/auth.guard';
import { googlePrincipalUserId } from '../../src/common/identity/deterministic-user-id';
import {
  GoogleIdentityVerificationError,
  type GoogleIdTokenVerifier,
} from '../../src/integrations/google-identity';
import { IdentityAccessService } from '../../src/modules/identity-access/services/identity-access.service';

function createMockContext(
  authHeader?: string,
  isPublic = false,
): { context: ExecutionContext; request: Record<string, unknown> } {
  const request: Record<string, unknown> = {
    headers: authHeader ? { authorization: authHeader } : {},
  };

  const reflector = {
    getAllAndOverride: () => isPublic,
  } as unknown as Reflector;

  const context = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;

  return { context, request };
}

test('AuthGuard: allows access to public routes without bearer token', async () => {
  const reflector = { getAllAndOverride: () => true } as unknown as Reflector;
  const guard = new AuthGuard(reflector);
  const { context } = createMockContext(undefined, true);

  const result = await guard.canActivate(context);
  assert.equal(result, true);
});

test('AuthGuard: rejects protected route when authorization header is missing', async () => {
  const reflector = { getAllAndOverride: () => false } as unknown as Reflector;
  const guard = new AuthGuard(reflector);
  const { context } = createMockContext(undefined, false);

  await assert.rejects(
    () => guard.canActivate(context),
    (err: unknown) => err instanceof UnauthorizedException,
  );
});

test('AuthGuard: rejects protected route when bearer token is empty', async () => {
  const reflector = { getAllAndOverride: () => false } as unknown as Reflector;
  const guard = new AuthGuard(reflector);
  const { context } = createMockContext('Bearer    ', false);

  await assert.rejects(
    () => guard.canActivate(context),
    (err: unknown) => err instanceof UnauthorizedException,
  );
});

test('AuthGuard: rejects arbitrary non-empty bearer token with 401 when verifier fails', async () => {
  const reflector = { getAllAndOverride: () => false } as unknown as Reflector;
  const fakeVerifier: GoogleIdTokenVerifier = {
    verify: async () => {
      throw new GoogleIdentityVerificationError('INVALID_TOKEN', 'Token signature invalid');
    },
  };
  const guard = new AuthGuard(reflector, fakeVerifier);
  const { context } = createMockContext('Bearer arbitrary-invalid-bearer-token', false);

  await assert.rejects(
    () => guard.canActivate(context),
    (err: unknown) => {
      assert.ok(err instanceof UnauthorizedException);
      assert.match((err as UnauthorizedException).message, /Xác thực Google thất bại/);
      return true;
    },
  );
});

test('AuthGuard: attaches verified principal to request context when token is valid', async () => {
  const reflector = { getAllAndOverride: () => false } as unknown as Reflector;
  const fakeVerifier: GoogleIdTokenVerifier = {
    verify: async (token: string) => {
      if (token === 'valid-google-id-token') {
        return {
          issuer: 'https://accounts.google.com',
          subject: 'sub-google-456',
          email: 'student@example.edu.vn',
          emailVerified: true,
          name: 'Nguyen Van B',
        };
      }
      throw new GoogleIdentityVerificationError('INVALID_TOKEN', 'Bad token');
    },
  };

  const guard = new AuthGuard(reflector, fakeVerifier);
  const { context, request } = createMockContext('Bearer valid-google-id-token', false);

  const allowed = await guard.canActivate(context);
  assert.equal(allowed, true);

  const expectedUserId = googlePrincipalUserId('https://accounts.google.com', 'sub-google-456');
  const user = request.user as Record<string, unknown>;
  assert.ok(user);
  assert.equal(user.userId, expectedUserId);
  assert.equal(user.provider, 'google');
  assert.equal(user.issuer, 'https://accounts.google.com');
  assert.equal(user.subject, 'sub-google-456');
  assert.equal(user.email, 'student@example.edu.vn');
  assert.equal(user.name, 'Nguyen Van B');
});

test('AuthGuard and IdentityAccessService share the exact same verifier seam and principal derivation', async () => {
  const fakeVerifier: GoogleIdTokenVerifier = {
    verify: async () => ({
      issuer: 'https://accounts.google.com',
      subject: 'sub-shared-test',
      email: 'shared@example.com',
    }),
  };

  const reflector = { getAllAndOverride: () => false } as unknown as Reflector;
  const guard = new AuthGuard(reflector, fakeVerifier);
  const { context, request } = createMockContext('Bearer test-token', false);
  await guard.canActivate(context);

  const ensured: string[] = [];
  const transactions = {
    run: async <T>(work: (ctx: never) => Promise<T>) =>
      work({
        repositories: {
          identity: {
            ensureUser: async (id: string) => {
              ensured.push(id);
            },
          },
        },
      } as never),
  };

  const service = new IdentityAccessService(transactions as never, fakeVerifier);
  const principal = await service.authenticateWithGoogle({ idToken: 'test-token' });

  assert.equal(principal.userId, (request.user as Record<string, unknown>).userId);
  assert.equal(principal.email, 'shared@example.com');
  assert.deepEqual(ensured, [principal.userId]);
});
