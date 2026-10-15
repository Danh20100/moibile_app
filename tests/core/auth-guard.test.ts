import assert from 'node:assert/strict';
import test from 'node:test';

import { ServiceUnavailableException, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AuthGuard } from '../../src/common/guards/auth.guard';
import { googlePrincipalUserId } from '../../src/common/identity/deterministic-user-id';
import { GooglePrincipalResolver } from '../../src/modules/identity-access/services/google-principal-resolver';
import { IdentityAccessService } from '../../src/modules/identity-access/services/identity-access.service';

function createMockContext(authHeader?: string, isPublic = false) {
  const request: Record<string, unknown> = { headers: authHeader ? { authorization: authHeader } : {} };
  const reflector = { getAllAndOverride: () => isPublic } as unknown as Reflector;
  const context = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request, reflector };
}

function createResolver(userId = 'resolved-user') {
  const resolved: string[] = [];
  const resolver = {
    resolve: async (token: string) => {
      resolved.push(token);
      return {
        userId,
        provider: 'google' as const,
        issuer: 'https://accounts.google.com',
        subject: 'google-subject',
        email: 'account@example.com',
      };
    },
  };
  return { resolver, resolved };
}

test('AuthGuard allows public routes without a token', async () => {
  const { context, reflector } = createMockContext(undefined, true);
  assert.equal(await new AuthGuard(reflector, createResolver().resolver).canActivate(context), true);
});

test('AuthGuard rejects protected routes without a nonempty bearer token', async () => {
  const { context, reflector } = createMockContext();
  const guard = new AuthGuard(reflector, createResolver().resolver);
  await assert.rejects(() => guard.canActivate(context), UnauthorizedException);
  const empty = createMockContext('Bearer    ');
  await assert.rejects(() => guard.canActivate(empty.context), UnauthorizedException);
});

test('AuthGuard assigns the resolved User returned by the shared resolver', async () => {
  const { context, reflector, request } = createMockContext('Bearer verified-google-token');
  const { resolver, resolved } = createResolver('durable-user');
  assert.equal(await new AuthGuard(reflector, resolver).canActivate(context), true);
  assert.deepEqual(resolved, ['verified-google-token']);
  assert.equal((request.user as { userId: string }).userId, 'durable-user');
});

test('login and protected requests call the same resolver; raw UUID derivation is not a fallback', async () => {
  const principal = {
    userId: googlePrincipalUserId('https://accounts.google.com', 'google-subject'),
    provider: 'google' as const,
    issuer: 'https://accounts.google.com',
    subject: 'google-subject',
  };
  const calls: string[] = [];
  const resolver = {
    resolve: async (token: string) => {
      calls.push(token);
      return { ...principal, userId: 'canonical-user' };
    },
  };
  const transactions = { run: async () => true };
  const service = new IdentityAccessService(transactions as never, resolver as GooglePrincipalResolver);
  const login = await service.authenticateWithGoogle({ idToken: 'login-token' });
  const { context, reflector } = createMockContext('Bearer request-token');
  await new AuthGuard(reflector, resolver).canActivate(context);
  assert.equal(login.userId, 'canonical-user');
  assert.equal((context.switchToHttp().getRequest() as { user: { userId: string } }).user.userId, 'canonical-user');
  assert.deepEqual(calls, ['login-token', 'request-token']);
});

test('Google resolution stays fail-closed while activation gate is disabled', async () => {
  const resolver = new GooglePrincipalResolver({} as never, { verify: async () => ({
    issuer: 'https://accounts.google.com', subject: 'existing-subject',
  }) }, false);
  await assert.rejects(() => resolver.resolve('valid-looking-token'), ServiceUnavailableException);
});
