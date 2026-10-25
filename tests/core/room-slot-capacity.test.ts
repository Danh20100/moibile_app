import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { ConflictException, ServiceUnavailableException } from '@nestjs/common';

import { assertOwnerRoomCapacity } from '../../src/modules/room/services/owner-capacity-policy';

describe('owner room slot enforcement', () => {
  it('allows only the free first room without purchased entitlements', () => {
    assert.doesNotThrow(() => assertOwnerRoomCapacity(0, 0));
    assert.throws(() => assertOwnerRoomCapacity(1, 0), ConflictException);
  });

  it('each verified active entitlement provides precisely one additional room', () => {
    assert.doesNotThrow(() => assertOwnerRoomCapacity(1, 1));
    assert.throws(() => assertOwnerRoomCapacity(2, 1), ConflictException);
    assert.doesNotThrow(() => assertOwnerRoomCapacity(3, 3));
    assert.throws(() => assertOwnerRoomCapacity(4, 3), ConflictException);
  });

  it('fails closed on missing, negative or malformed counts', () => {
    for (const value of [Number.NaN, -1, 0.2, Number.POSITIVE_INFINITY]) {
      assert.throws(() => assertOwnerRoomCapacity(value, 0), ServiceUnavailableException);
      assert.throws(() => assertOwnerRoomCapacity(0, value), ServiceUnavailableException);
    }
  });

  it('checks entitlement and rooms inside a transaction locked by OWNER, not property', () => {
    const source = readFileSync('src/modules/room/services/room.service.ts', 'utf8');
    assert.match(source, /\.transaction\(\)\.execute\(/);
    assert.match(source, /pg_advisory_xact_lock\(hashtextextended\(/);
    assert.match(source, /o\.primary_owner_user_id\s*=\s*\$\{ownerId\}/);
    assert.match(source, /owner_slot_entitlements[\s\S]*valid_until\s*>\s*now\(\)/);
    assert.match(source, /assertOwnerRoomCapacity\([\s\S]*INSERT INTO rooms/);
  });
});
