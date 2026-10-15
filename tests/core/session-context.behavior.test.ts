import assert from 'node:assert/strict';
import test from 'node:test';

import { UnauthorizedException } from '@nestjs/common';

import type { VerifiedPrincipal } from '../../src/modules/identity-access/contracts';
import { IdentityAccessController } from '../../src/modules/identity-access/controllers/identity-access.controller';
import { IdentityAccessService } from '../../src/modules/identity-access/services/identity-access.service';

const identityFoundation = {
  initializeProfileIfAbsent: async (input: { userId: string; displayName: string | null; now: string }) => ({
    userId: input.userId,
    displayName: input.displayName,
    createdAt: input.now,
    updatedAt: input.now,
  }),
};

test('session-context: user with no relationships receives empty arrays', async () => {
  const transactions = {
    run: async <T>(work: (ctx: never) => Promise<T>) =>
      work({
        repositories: {
          identityFoundation,
          organization: {
            findByPrimaryOwnerUserId: async () => [],
          },
          tenancy: {
            findParticipantsByUser: async () => [],
          },
        },
      } as never),
  };

  const service = new IdentityAccessService(transactions as never);
  const principal: VerifiedPrincipal = {
    userId: 'user-no-rel',
    provider: 'google',
    issuer: 'https://accounts.google.com',
    subject: 'sub-no-rel',
    email: 'norel@example.com',
    name: 'No Relationships',
  };

  const context = await service.getSessionContext(principal);

  assert.equal(context.userId, 'user-no-rel');
  assert.deepEqual(context.operatedOrganizationIds, []);
  assert.deepEqual(context.linkedTenancyIds, []);
  assert.equal(context.email, 'norel@example.com');
  assert.equal(context.name, 'No Relationships');
});

test('session-context: user who is both primary owner and linked participant receives both lists, deduped and sorted', async () => {
  const transactions = {
    run: async <T>(work: (ctx: never) => Promise<T>) =>
      work({
        repositories: {
          identityFoundation,
          organization: {
            findByPrimaryOwnerUserId: async (uid: string) => {
              if (uid === 'dual-user') {
                return [
                  { organizationId: 'org-c', primaryOwnerUserId: uid, name: 'Org C' },
                  { organizationId: 'org-a', primaryOwnerUserId: uid, name: 'Org A' },
                  { organizationId: 'org-c', primaryOwnerUserId: uid, name: 'Org C Duplicate' },
                ];
              }
              return [];
            },
          },
          tenancy: {
            findParticipantsByUser: async (uid: string) => {
              if (uid === 'dual-user') {
                return [
                  { tenancyParticipantId: 'p2', tenancyId: 'ten-z', userId: uid, role: 'PRIMARY', joinedAt: '2026-01-01', leftAt: null },
                  { tenancyParticipantId: 'p1', tenancyId: 'ten-m', userId: uid, role: 'OCCUPANT', joinedAt: '2026-01-01', leftAt: null },
                  { tenancyParticipantId: 'p3', tenancyId: 'ten-z', userId: uid, role: 'PRIMARY', joinedAt: '2026-01-02', leftAt: null },
                ];
              }
              return [];
            },
          },
        },
      } as never),
  };

  const service = new IdentityAccessService(transactions as never);
  const principal: VerifiedPrincipal = {
    userId: 'dual-user',
    provider: 'google',
    issuer: 'https://accounts.google.com',
    subject: 'sub-dual',
    email: 'dual@example.com',
  };

  const context = await service.getSessionContext(principal);

  assert.equal(context.userId, 'dual-user');
  assert.deepEqual(context.operatedOrganizationIds, ['org-a', 'org-c']);
  assert.deepEqual(context.linkedTenancyIds, ['ten-m', 'ten-z']);
  assert.equal(context.email, 'dual@example.com');
});

test('session-context: controller rejects request if user is not in request context', async () => {
  const service = new IdentityAccessService({ run: async () => undefined } as never);
  const controller = new IdentityAccessController(service);

  await assert.rejects(
    () => controller.getSessionContext(undefined),
    (err: unknown) => err instanceof UnauthorizedException,
  );
});

test('session-context: controller extracts verified user and delegates to service without reading userId from client input', async () => {
  let queriedUserId = '';
  const transactions = {
    run: async <T>(work: (ctx: never) => Promise<T>) =>
      work({
        repositories: {
          identityFoundation,
          organization: {
            findByPrimaryOwnerUserId: async (uid: string) => {
              queriedUserId = uid;
              return [{ organizationId: 'org-1', primaryOwnerUserId: uid, name: 'Org 1' }];
            },
          },
          tenancy: {
            findParticipantsByUser: async () => [],
          },
        },
      } as never),
  };

  const service = new IdentityAccessService(transactions as never);
  const controller = new IdentityAccessController(service);

  const principal: VerifiedPrincipal = {
    userId: 'verified-user-123',
    provider: 'google',
    issuer: 'https://accounts.google.com',
    subject: 'sub-123',
  };

  const result = await controller.getSessionContext(principal);

  assert.equal(queriedUserId, 'verified-user-123');
  assert.equal(result.userId, 'verified-user-123');
  assert.deepEqual(result.operatedOrganizationIds, ['org-1']);
});
