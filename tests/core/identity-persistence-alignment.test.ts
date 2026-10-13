import assert from 'node:assert/strict';
import test from 'node:test';
import { loadFixture } from '../support/fixture-loader';

import { googlePrincipalUserId } from '../../src/common/identity/deterministic-user-id';
import type { GoogleIdTokenVerifier } from '../../src/integrations/google-identity';
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

test('Google identity preserves persisted UUID vectors and whitespace normalization', () => {
  // Independently derived with Python uuid.uuid5, using the existing identity namespace.
  assert.equal(googlePrincipalUserId(F.values.canonicalIssuer, G.subjectFirst), G.userFirst);
  assert.equal(googlePrincipalUserId(F.values.bareIssuer, G.subjectFirst), G.userBare);
  assert.equal(googlePrincipalUserId(F.values.canonicalIssuer, G.subjectSecond), G.userSecond);
  assert.equal(googlePrincipalUserId(G.whitespaceIssuer, G.whitespaceSubject), G.userFirst);
});

test('authentication idempotently ensures USER and keeps provider claims at principal boundary', async () => {
  const ensured: string[] = [];
  const transactions = {
    run: async <T>(work: (context: never) => Promise<T>) =>
      work({
        repositories: {
          identity: {
            ensureUser: async (id: string) => {
              ensured.push(id);
            },
            userExists: async () => G.expectedUserExists,
          },
        },
        afterCommit: () => undefined,
      } as never),
  };
  const service = new IdentityAccessService(transactions);
  Object.defineProperty(service, 'verifier', {
    writable: true,
    value: {
      verify: async () => ({
        issuer: F.values.canonicalIssuer,
        subject: G.subjectFirst,
        email: G.mockEmail,
      }),
    } satisfies GoogleIdTokenVerifier,
  });

  const first = await service.authenticateWithGoogle({ idToken: G.mockToken });
  const second = await service.authenticateWithGoogle({ idToken: G.mockToken });
  assert.equal(first.userId, second.userId);
  assert.deepEqual(ensured, [first.userId, first.userId]);
  assert.equal(first.email, G.mockEmail);
  assert.deepEqual(await service.findUserById(first.userId), { userId: first.userId });
});

type SeedClaimFixture = {
  version: number;
  principal: { issuer: string; subject: string };
  idToken: string;
  expectedUserId: string;
  organization: { organizationId: string; primaryOwnerUserId: string; name: string };
  participant: {
    tenancyParticipantId: string;
    tenancyId: string;
    userId: string;
    role: string;
    joinedAt: string;
    leftAt: null;
  };
  missingParticipant: null;
  userExists: boolean;
  environment: string;
  productionEnvironment: string;
  claimUserId: string;
  expectedEnsuredUsers: string[];
  expectedNoUpdates: unknown[];
  deniedCases: Record<string, { environment?: string; claimUserId?: string }>;
};
const S = loadFixture<SeedClaimFixture>('identity/payment-seed-claim');

function seedClaimHarness() {
  const ensured: string[] = [];
  const updates: unknown[] = [];
  const organization = structuredClone(S.organization);
  const participant = structuredClone(S.participant);
  const transactions = {
    run: async <T>(work: (context: never) => Promise<T>) =>
      work({
        repositories: {
          identity: {
            ensureUser: async (userId: string) => {
              ensured.push(userId);
            },
            userExists: async () => S.userExists,
          },
          organization: {
            findOrganization: async (id: string) =>
              id === organization.organizationId ? organization : undefined,
            updateOrganization: async (record: typeof organization) => {
              updates.push(record);
              Object.assign(organization, record);
            },
          },
          tenancy: {
            findParticipant: async (id: string) =>
              id === participant.tenancyParticipantId ? participant : S.missingParticipant,
            updateParticipant: async (record: typeof participant) => {
              updates.push(record);
              Object.assign(participant, record);
            },
          },
        },
        afterCommit: () => undefined,
      } as never),
  };
  const service = new IdentityAccessService(transactions, {
    verify: async () => S.principal,
  } satisfies GoogleIdTokenVerifier);
  return { service, organization, participant, ensured, updates };
}

async function withSeedClaimEnvironment(
  config: { environment?: string; claimUserId?: string },
  work: () => Promise<void>,
) {
  const previousEnvironment = process.env.NODE_ENV;
  const previousClaimUser = process.env.TROOI_DEMO_CLAIM_USER_ID;
  try {
    if (config.environment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = config.environment;
    if (config.claimUserId === undefined) delete process.env.TROOI_DEMO_CLAIM_USER_ID;
    else process.env.TROOI_DEMO_CLAIM_USER_ID = config.claimUserId;
    await work();
  } finally {
    if (previousEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnvironment;
    if (previousClaimUser === undefined) delete process.env.TROOI_DEMO_CLAIM_USER_ID;
    else process.env.TROOI_DEMO_CLAIM_USER_ID = previousClaimUser;
  }
}

test('first Google login claims the seeded payment room from the synthetic user', async () => {
  const { service, organization, participant } = seedClaimHarness();
  await withSeedClaimEnvironment(S, async () => {
    const principal = await service.authenticateWithGoogle({ idToken: S.idToken });
    assert.equal(principal.userId, S.expectedUserId);
    assert.equal(organization.primaryOwnerUserId, S.expectedUserId);
    assert.equal(participant.userId, S.expectedUserId);
  });
});

for (const [name, config] of Object.entries(S.deniedCases)) {
  test(`Google login preserves its User without seeded ownership claims: ${name}`, async () => {
    const { service, organization, participant, ensured, updates } = seedClaimHarness();
    await withSeedClaimEnvironment(config, async () => {
      const principal = await service.authenticateWithGoogle({ idToken: S.idToken });
      assert.equal(principal.userId, S.expectedUserId);
      assert.deepEqual(ensured, S.expectedEnsuredUsers);
      assert.deepEqual(updates, S.expectedNoUpdates);
      assert.deepEqual(organization, S.organization);
      assert.deepEqual(participant, S.participant);
    });
  });
}
