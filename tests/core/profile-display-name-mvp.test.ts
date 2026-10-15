import assert from 'node:assert/strict';
import test from 'node:test';

import { BadRequestException } from '@nestjs/common';
import type { ProfileRecord } from '../../src/persistence/ports/identity-foundation.repository';
import type { TransactionManager } from '../../src/persistence/ports/transaction-manager';
import type { VerifiedPrincipal } from '../../src/modules/identity-access/contracts';
import { IdentityAccessService } from '../../src/modules/identity-access/services/identity-access.service';

const principal = (userId: string, name: string): VerifiedPrincipal => ({
  userId,
  provider: 'google',
  issuer: 'https://accounts.google.com',
  subject: 'subject-' + userId,
  email: 'verified@example.test',
  emailVerified: true,
  name,
});

function harness() {
  const profiles = new Map<string, ProfileRecord>();
  const writes: string[] = [];
  const transactions = {
    run: async <T>(work: (context: never) => Promise<T>): Promise<T> =>
      work({
        repositories: {
          identityFoundation: {
            initializeProfileIfAbsent: async (input: {
              userId: string; displayName: string | null; now: string;
            }): Promise<ProfileRecord> => {
              if (!profiles.has(input.userId)) {
                profiles.set(input.userId, {
                  userId: input.userId,
                  displayName: input.displayName,
                  createdAt: input.now,
                  updatedAt: input.now,
                });
              }
              return profiles.get(input.userId)!;
            },
            updateOwnDisplayName: async (input: {
              userId: string; displayName: string; now: string;
            }): Promise<ProfileRecord> => {
              const previous = profiles.get(input.userId);
              if (!previous) throw new Error('Missing own Profile');
              const updated = { ...previous, displayName: input.displayName, updatedAt: input.now };
              profiles.set(input.userId, updated);
              writes.push(input.userId);
              return updated;
            },
          },
          organization: { findByPrimaryOwnerUserId: async () => [] },
          tenancy: { findParticipantsByUser: async () => [] },
        },
        afterCommit: () => undefined,
      } as never),
  } as TransactionManager;
  return { service: new IdentityAccessService(transactions), profiles, writes };
}

test('Profile edit changes only the authenticated User; never the other account', async () => {
  const { service, writes, profiles } = harness();
  const alice = principal('11111111-1111-4111-8111-111111111111', 'Alice Google');
  const bob = principal('22222222-2222-4222-8222-222222222222', 'Bob Google');
  await service.getOwnProfile(alice);
  await service.getOwnProfile(bob);
  const edited = await service.updateOwnDisplayName(alice, '  Tên của tôi  ');
  assert.equal(edited.displayName, 'Tên của tôi');
  assert.deepEqual(writes, [alice.userId]);
  assert.equal(profiles.get(bob.userId)?.displayName, 'Bob Google');
});

test('Google claim refresh cannot overwrite an already edited display name', async () => {
  const { service } = harness();
  const user = principal('33333333-3333-4333-8333-333333333333', 'Tên Google cũ');
  assert.equal((await service.getSessionContext(user)).name, 'Tên Google cũ');
  await service.updateOwnDisplayName(user, 'Tên người dùng tự chọn');
  const changedGoogleClaim = { ...user, name: 'Tên Google mới' };
  const session = await service.getSessionContext(changedGoogleClaim);
  assert.equal(session.name, 'Tên người dùng tự chọn');
  assert.equal(session.email, 'verified@example.test');
  assert.deepEqual(session.operatedOrganizationIds, []);
  assert.deepEqual(session.linkedTenancyIds, []);
});

test('Profile rejects empty, control-character and oversized display names without writing', async () => {
  const { service, writes } = harness();
  const user = principal('44444444-4444-4444-8444-444444444444', 'Example');
  await service.getOwnProfile(user);
  for (const bad of ['  ', 'bad\nname', 'x'.repeat(81)]) {
    await assert.rejects(
      () => service.updateOwnDisplayName(user, bad),
      (error: unknown) => error instanceof BadRequestException,
    );
  }
  assert.deepEqual(writes, []);
});
