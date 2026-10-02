import assert from 'node:assert/strict';
import test from 'node:test';

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { NotificationService } from '../../src/modules/notification/services/notification.service';
import { createCoreTestTransactionManager } from './support/in-memory-transaction-manager';

test('NotificationService: lists only notifications for the authenticated recipient', async () => {
  const transactions = createCoreTestTransactionManager();
  const service = new NotificationService(transactions);
  const user1 = 'user-1';
  const user2 = 'user-2';

  await transactions.run(async ({ repositories }) => {
    await repositories.notification.createNotification({
      notificationId: randomUUID(),
      recipientUserId: user1,
      category: 'NEW_INQUIRY',
      messageOrPayloadReference: 'inquiry:1',
      deliveryStatus: 'PENDING',
      createdAt: new Date().toISOString(),
      deliveredAt: null,
      readAt: null,
    });
    await repositories.notification.createNotification({
      notificationId: randomUUID(),
      recipientUserId: user2,
      category: 'PAYMENT_DUE',
      messageOrPayloadReference: 'billing_cycle:1',
      deliveryStatus: 'PENDING',
      createdAt: new Date().toISOString(),
      deliveredAt: null,
      readAt: null,
    });
  });

  const listUser1 = await service.findByRecipient(user1);
  assert.equal(listUser1.length, 1);
  assert.equal(listUser1[0]?.recipientUserId, user1);
  assert.equal(listUser1[0]?.category, 'NEW_INQUIRY');

  const listUser2 = await service.findByRecipient(user2);
  assert.equal(listUser2.length, 1);
  assert.equal(listUser2[0]?.recipientUserId, user2);
  assert.equal(listUser2[0]?.category, 'PAYMENT_DUE');
});

test('NotificationService: enforces recipient authorization on findById', async () => {
  const transactions = createCoreTestTransactionManager();
  const service = new NotificationService(transactions);
  const user1 = 'user-1';
  const user2 = 'user-2';
  const notifId = randomUUID();

  await transactions.run(async ({ repositories }) => {
    await repositories.notification.createNotification({
      notificationId: notifId,
      recipientUserId: user1,
      category: 'TENANCY_NOTICE',
      messageOrPayloadReference: 'tenancy_notice:1',
      deliveryStatus: 'PENDING',
      createdAt: new Date().toISOString(),
      deliveredAt: null,
      readAt: null,
    });
  });

  const found = await service.findById(notifId, user1);
  assert.equal(found.id, notifId);

  await assert.rejects(
    service.findById(notifId, user2),
    ForbiddenException,
  );

  await assert.rejects(
    service.findById('non-existent-id', user1),
    NotFoundException,
  );
});

test('NotificationService: markAsRead updates readAt without mutating source state', async () => {
  const transactions = createCoreTestTransactionManager();
  const service = new NotificationService(transactions);
  const user = 'user-1';
  const notifId = randomUUID();

  await transactions.run(async ({ repositories }) => {
    await repositories.notification.createNotification({
      notificationId: notifId,
      recipientUserId: user,
      category: 'NEW_INCIDENT',
      messageOrPayloadReference: 'incident:1',
      deliveryStatus: 'PENDING',
      createdAt: '2026-10-01T00:00:00.000Z',
      deliveredAt: null,
      readAt: null,
    });
  });

  const read = await service.markAsRead(notifId, user);
  assert.equal(read.id, notifId);
  assert.ok(read.readAt !== null);
  assert.equal(read.deliveryStatus, 'DELIVERED');

  const reloaded = await service.findById(notifId, user);
  assert.equal(reloaded.readAt, read.readAt);
  assert.equal(reloaded.messageOrPayloadReference, 'incident:1');
});
