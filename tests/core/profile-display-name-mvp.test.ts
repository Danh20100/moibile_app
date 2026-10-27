import assert from 'node:assert/strict';
import test from 'node:test';

import { BadRequestException, ForbiddenException } from '@nestjs/common';
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
  const credentials = new Set<string>();
  const contacts = new Map<string, { phone_number: string | null; residential_address: string | null }>();
  const database = {
    selectFrom: (table: string) => ({
      select: (_columns: unknown) => ({
        where: (_column: string, _operator: string, userId: string) => ({
          executeTakeFirst: async () => table === 'password_credentials'
            ? credentials.has(userId) ? { user_id: userId } : undefined
            : contacts.has(userId) ? { ...contacts.get(userId) } : undefined,
        }),
      }),
    }),
    updateTable: (table: string) => ({
      set: (fields: { phone_number?: string | null; residential_address?: string | null }) => ({
        where: (_column: string, _operator: string, userId: string) => ({
          returning: (_columns: unknown) => ({
            executeTakeFirstOrThrow: async () => {
              assert.equal(table, 'user_profiles');
              const next = { phone_number: null, residential_address: null, ...contacts.get(userId), ...fields };
              contacts.set(userId, next);
              return next;
            },
          }),
        }),
      }),
    }),
  };
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
          tenancy: { findCurrentParticipantsByUser: async () => [] },
        },
        afterCommit: () => undefined,
      } as never),
  } as TransactionManager;
  return { service: new IdentityAccessService(transactions, undefined, database as never), profiles, writes, credentials, contacts };
}

test('Profile edit changes only the authenticated User; never the other account', async () => {
  const { service, writes, profiles, credentials } = harness();
  const alice = principal('11111111-1111-4111-8111-111111111111', 'Alice Google');
  const bob = principal('22222222-2222-4222-8222-222222222222', 'Bob Google');
  await service.getOwnProfile(alice);
  await service.getOwnProfile(bob);
  credentials.add(alice.userId);
  const edited = await service.updateOwnDisplayName(alice, '  Tên của tôi  ');
  assert.equal(edited.displayName, 'Tên của tôi');
  assert.deepEqual(writes, [alice.userId]);
  assert.equal(profiles.get(bob.userId)?.displayName, 'Bob Google');
});

test('Google claim refresh cannot overwrite an already edited display name', async () => {
  const { service, credentials } = harness();
  const user = principal('33333333-3333-4333-8333-333333333333', 'Tên Google cũ');
  credentials.add(user.userId);
  assert.equal((await service.getSessionContext(user)).name, 'Tên Google cũ');
  await service.updateOwnDisplayName(user, 'Tên người dùng tự chọn');
  const changedGoogleClaim = { ...user, name: 'Tên Google mới' };
  const session = await service.getSessionContext(changedGoogleClaim);
  assert.equal(session.name, 'Tên người dùng tự chọn');
  assert.equal(session.email, 'verified@example.test');
  assert.deepEqual(session.operatedOrganizationIds, []);
  assert.deepEqual(session.linkedTenancyIds, []);
});

test('Google-only profile edits require an initialized password credential', async () => {
  const { service, writes, profiles } = harness();
  const user = principal('55555555-5555-4555-8555-555555555555', 'Google only');
  await service.getOwnProfile(user);
  await assert.rejects(() => service.updateOwnDisplayName(user, 'Edited'), ForbiddenException);
  await assert.rejects(
    () => service.updateOwnContact(user, { phoneNumber: '0912345678' }),
    ForbiddenException,
  );
  assert.equal(profiles.get(user.userId)?.displayName, 'Google only');
  assert.deepEqual(writes, []);
});

test('Profile phone and residential address persist only on the authenticated User', async () => {
  const { service, credentials } = harness();
  const alice = principal('66666666-6666-4666-8666-666666666666', 'Alice');
  const bob = principal('77777777-7777-4777-8777-777777777777', 'Bob');
  credentials.add(alice.userId);
  credentials.add(bob.userId);
  assert.deepEqual(await service.updateOwnContact(alice, { phoneNumber: '0901234567' }), {
    phoneNumber: '0901234567', residentialAddress: null,
  });
  assert.deepEqual(await service.updateOwnContact(alice, { residentialAddress: '12 Nguyễn Huệ' }), {
    phoneNumber: '0901234567', residentialAddress: '12 Nguyễn Huệ',
  });
  assert.deepEqual(await service.getOwnContact(alice), { phoneNumber: '0901234567', residentialAddress: '12 Nguyễn Huệ' });
  assert.deepEqual(await service.getOwnContact(bob), { phoneNumber: null, residentialAddress: null });
});

test('Profile contact validation rejects invalid phone and oversized/control-character address before writing', async () => {
  const { service, contacts, credentials } = harness();
  const user = principal('88888888-8888-4888-8888-888888888888', 'Owner');
  credentials.add(user.userId);
  await assert.rejects(service.updateOwnContact(user, { phoneNumber: 'not-a-phone' }), BadRequestException);
  await assert.rejects(service.updateOwnContact(user, { residentialAddress: `A${'x'.repeat(255)}` }), BadRequestException);
  await assert.rejects(service.updateOwnContact(user, { residentialAddress: 'Invalid\nAddress' }), BadRequestException);
  assert.equal(contacts.has(user.userId), false);
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
