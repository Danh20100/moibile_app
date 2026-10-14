import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException } from '@nestjs/common';

import { decodeMessageCursor, encodeMessageCursor } from '../../src/modules/messaging/messaging.service';

test('message cursor round-trips an ordered timestamp and UUID key', () => {
  const cursor = { createdAt: '2026-10-14T10:15:30.000Z', messageId: 'a1000000-0000-4000-8000-000000000001' };
  assert.deepEqual(decodeMessageCursor(encodeMessageCursor(cursor)), cursor);
});

test('message cursor rejects malformed, non-canonical and unexpected payloads', () => {
  for (const cursor of [
    'not-a-cursor',
    Buffer.from(JSON.stringify({ createdAt: 'invalid', messageId: 'a1000000-0000-4000-8000-000000000001' })).toString('base64url'),
    Buffer.from(JSON.stringify({ createdAt: '2026-10-14T10:15:30.000Z', messageId: 'not-a-uuid' })).toString('base64url'),
    Buffer.from(JSON.stringify({ createdAt: '2026-10-14T10:15:30.000Z', messageId: 'a1000000-0000-4000-8000-000000000001', ownerId: 'another-user' })).toString('base64url'),
    'a'.repeat(513),
  ]) {
    assert.throws(() => decodeMessageCursor(cursor), BadRequestException);
  }
});
