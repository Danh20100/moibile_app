import assert from 'node:assert/strict';
import test from 'node:test';

import { googlePrincipalUserId } from '../../src/common/identity/deterministic-user-id';
import type { GoogleIdTokenVerifier } from '../../src/integrations/google-identity';
import { IdentityAccessService } from '../../src/modules/identity-access/services/identity-access.service';
import { readRepoFiles } from '../conformance/erd3/support/source';

test('Google principal maps to a stable RFC 4122 UUIDv5 using issuer and subject', () => {
  const first = googlePrincipalUserId('https://accounts.google.com', 'subject-1');
  assert.equal(first, googlePrincipalUserId('https://accounts.google.com', 'subject-1'));
  assert.match(first, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.notEqual(first, googlePrincipalUserId('accounts.google.com', 'subject-1'));
  assert.notEqual(first, googlePrincipalUserId('https://accounts.google.com', 'subject-2'));
});

test('authentication idempotently ensures USER and keeps provider claims at principal boundary', async () => {
  const ensured: string[] = [];
  const transactions = {
    run: async <T>(work: (context: never) => Promise<T>) => work({
      repositories: { identity: { ensureUser: async (id: string) => { ensured.push(id); }, userExists: async () => true } },
      afterCommit: () => undefined,
    } as never),
  };
  const service = new IdentityAccessService(transactions);
  Object.defineProperty(service, 'verifier', { writable: true, value: {
    verify: async () => ({ issuer: 'https://accounts.google.com', subject: 'subject-1', email: 'person@example.com' }),
  } satisfies GoogleIdTokenVerifier });

  const first = await service.authenticateWithGoogle({ idToken: 'token' });
  const second = await service.authenticateWithGoogle({ idToken: 'token' });
  assert.equal(first.userId, second.userId);
  assert.deepEqual(ensured, [first.userId, first.userId]);
  assert.equal(first.email, 'person@example.com');
  assert.deepEqual(await service.findUserById(first.userId), { userId: first.userId });
});

test('physical-backed core contracts expose no non-persisted profile fields or prefixed random IDs', () => {
  const contracts = readRepoFiles([
    'src/modules/identity-access/contracts/index.ts',
    'src/modules/organization/contracts/index.ts',
    'src/modules/property/contracts/index.ts',
    'src/modules/room/contracts/index.ts',
  ]);
  assert.doesNotMatch(contracts, /externalSubject|createdAt|updatedAt/);

  const services = readRepoFiles([
    'src/modules/identity-access/services/identity-access.service.ts',
    'src/modules/organization/services/organization.service.ts',
    'src/modules/property/services/property.service.ts',
    'src/modules/room/services/room.service.ts',
    'src/modules/listing/services/listing.service.ts',
    'src/modules/listing/services/inquiry.service.ts',
    'src/modules/tenancy/services/tenancy.service.ts',
    'src/modules/billing/services/billing.service.ts',
    'src/modules/receipt/services/receipt.service.ts',
    'src/modules/incident/services/incident.service.ts',
    'src/modules/audit-trust/services/audit-trust.service.ts',
  ]);
  assert.doesNotMatch(services, /Date\.now\(\)[\s\S]{0,80}Math\.random|`(?:user|org|prop|room|list|ten|bill|rcpt|inc|rep)_/);
});
