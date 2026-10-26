import assert from 'node:assert/strict';
import test from 'node:test';

import { signInMethodsOf } from '../../src/modules/identity-access/services/sign-in-methods';

test('sign-in methods follow the stored mailbox owner, not the spelling the caller typed', () => {
  assert.deepEqual(
    signInMethodsOf({
      userId: 'u1',
      normalizedEmail: 'a@gmail.com',
      verificationSource: 'google',
      hasGoogleIdentity: true,
      hasPassword: false,
    }),
    ['google'],
  );
  assert.deepEqual(
    signInMethodsOf({
      userId: 'u2',
      normalizedEmail: 'b@example.test',
      verificationSource: 'email_otp',
      hasGoogleIdentity: false,
      hasPassword: true,
    }),
    ['password'],
  );
});
