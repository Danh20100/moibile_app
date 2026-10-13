import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeLoginEmail } from '../../src/common/identity/normalize-login-email';
import { loadEmailNormalization } from '../support/identity-fixtures';

const fixture = loadEmailNormalization();
test('approved login normalization folds ASCII case and IDNA without provider alias merging', () => {
  for (const scenario of fixture.valid)
    assert.equal(normalizeLoginEmail(scenario.address), scenario.expected);
  for (const [left, right] of fixture.distinctPairs)
    assert.notEqual(normalizeLoginEmail(left!), normalizeLoginEmail(right!));
});
test('normalization rejects unsupported local parts and URL/path repair', () => {
  for (const address of fixture.invalid)
    assert.throws(() => normalizeLoginEmail(address), new RegExp(fixture.expectedError), address);
});
