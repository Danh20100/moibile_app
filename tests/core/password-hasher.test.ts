import assert from 'node:assert/strict';
import test from 'node:test';

import { hashPassword, verifyPassword } from '../../src/modules/identity-access/services/password-hasher';

const STORAGE_PATTERN =
  /^\$argon2id\$v=19\$m=[1-9][0-9]*,t=[1-9][0-9]*,p=[1-9][0-9]*\$[A-Za-z0-9+/]+\$[A-Za-z0-9+/]+$/;

test('password hasher stores an unpadded argon2id string that verifies', async () => {
  const encoded = await hashPassword('correct-horse');
  assert.match(encoded, STORAGE_PATTERN);
  const parts = encoded.split('$');
  assert.equal(parts.at(-2)?.endsWith('='), false);
  assert.equal(parts.at(-1)?.endsWith('='), false);
  assert.equal(await verifyPassword(encoded, 'correct-horse'), true);
  assert.equal(await verifyPassword(encoded, 'wrong-password'), false);
});
