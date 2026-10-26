import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { joinTokenHash, validJoinToken } from '../../src/modules/tenancy/services/tenancy-join.service';

test('join token requires 256-bit lowercase hex', () => {
  const token = 'ab'.repeat(32);
  assert.equal(validJoinToken(token), true);
  assert.equal(validJoinToken(token.toUpperCase()), false);
  assert.equal(validJoinToken('ab'.repeat(31)), false);
  assert.equal(validJoinToken('x'.repeat(64)), false);
  assert.equal(validJoinToken(''), false);
});

test('join invitation stores a one-way hash, never a bearer token', () => {
  const token = '01'.repeat(32);
  const digest = joinTokenHash(token);
  assert.equal(digest, createHash('sha256').update(token).digest('hex'));
  assert.equal(digest.length, 64);
  assert.notEqual(digest, token);
  assert.notEqual(joinTokenHash('02'.repeat(32)), digest);
});
