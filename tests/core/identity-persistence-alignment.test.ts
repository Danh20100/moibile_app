import assert from 'node:assert/strict';
import test from 'node:test';

import { googlePrincipalUserId } from '../../src/common/identity/deterministic-user-id';
import { IdentityAccessService } from '../../src/modules/identity-access/services/identity-access.service';
import { loadGooglePrincipals, loadPersistenceScenarios } from '../support/identity-fixtures';

const G = loadGooglePrincipals();
const F = loadPersistenceScenarios();

test('Google principal maps to a stable RFC 4122 UUIDv5 using issuer and subject', () => {
  const first = googlePrincipalUserId(F.values.canonicalIssuer, G.subjectFirst);
  assert.equal(first, googlePrincipalUserId(F.values.canonicalIssuer, G.subjectFirst));
  assert.match(first, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.notEqual(first, googlePrincipalUserId(F.values.bareIssuer, G.subjectFirst));
  assert.notEqual(first, googlePrincipalUserId(F.values.canonicalIssuer, G.subjectSecond));
});

test('Google identity preserves historical UUID vectors and whitespace behavior', () => {
  assert.equal(googlePrincipalUserId(F.values.canonicalIssuer, G.subjectFirst), G.userFirst);
  assert.equal(googlePrincipalUserId(F.values.bareIssuer, G.subjectFirst), G.userBare);
  assert.equal(googlePrincipalUserId(F.values.canonicalIssuer, G.subjectSecond), G.userSecond);
  assert.equal(googlePrincipalUserId(G.whitespaceIssuer, G.whitespaceSubject), G.userFirst);
});

test('Google login uses the shared resolver and does not mutate rental ownership', async () => {
  const resolved: string[] = [];
  const service = new IdentityAccessService({} as never, {
    resolve: async (token: string) => {
      resolved.push(token);
      return {
        userId: G.userFirst,
        provider: 'google',
        issuer: F.values.canonicalIssuer,
        subject: G.subjectFirst,
        email: G.mockEmail,
      };
    },
  } as never);
  const first = await service.authenticateWithGoogle({ idToken: G.mockToken });
  const second = await service.authenticateWithGoogle({ idToken: G.mockToken });
  assert.equal(first.userId, second.userId);
  assert.deepEqual(resolved, [G.mockToken, G.mockToken]);
  assert.equal(first.email, G.mockEmail);
});
