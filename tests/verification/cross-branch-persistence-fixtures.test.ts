import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import { loadFixture, validateFixture } from '../support/fixture-loader';
import { createPaymentFixtureIds, paymentData } from '../support/payment-fixtures';
import { businessLiteralFindings } from './support/identity-test-governance';

const files = [
  'tests/core/identity-persistence-alignment.test.ts',
  'tests/core/momo-client.test.ts',
  'tests/core/momo-hmac.test.ts',
  'tests/core/sepay-production.test.ts',
  'tests/core/sepay-protocol.test.ts',
  'tests/integration/persistence/demo-gateway-migration.integration.ts',
  'tests/integration/persistence/migration-parity.integration.ts',
  'tests/integration/persistence/payment-gateway.integration.ts',
  'tests/integration/persistence/payment-gateway-concurrency.integration.ts',
  'tests/integration/persistence/sepay-flow.integration.ts',
  'tests/integration/persistence/gateway-test-support.ts',
  'tests/integration/persistence/guards/rental-concurrency.integration.ts',
  'tests/integration/persistence/guards/rental-guards.integration.ts',
  'tests/integration/persistence/guards/rental-test-support.ts',
  'tests/integration/persistence/support/payment-migration-prefix.ts',
  'tests/support/payment-fixtures.ts',
  'tests/support/rental-fixtures.ts',
  'tests/support/sepay-regression-fixtures.ts',
  'tests/support/momo-client-fixtures.ts',
  'tests/support/momo-hmac-fixtures.ts',
  'tests/support/sepay-protocol-fixtures.ts',
];

test('cross-branch regression tests and mocks have correct placement and no inline business datasets', () => {
  for (const file of files) {
    assert.match(file, /^tests\/(?:core|integration\/persistence|support)\//);
    assert.deepEqual(businessLiteralFindings(file), [], file);
    assert.doesNotMatch(readFileSync(file, 'utf8'), /setTimeout|setInterval/);
  }
  if (existsSync('tests/core/fixtures')) assert.deepEqual(readdirSync('tests/core/fixtures'), []);
});

test('all shared identity payment and rental fixtures validate fail closed and reject duplicate datasets', () => {
  const seen = new Set<string>();
  for (const domain of ['identity', 'payment', 'rental']) {
    for (const filename of readdirSync('tests/fixtures/' + domain)) {
      if (!filename.endsWith('.json') || filename.endsWith('.schema.json')) continue;
      const name = domain + '/' + filename.slice(0, -5);
      const data = loadFixture<Record<string, unknown>>(name);
      assert.ok(Object.isFrozen(data), name);
      const encoded = JSON.stringify(data);
      assert.ok(!seen.has(encoded), 'duplicate fixture dataset: ' + name);
      seen.add(encoded);
      const schema = JSON.parse(readFileSync('tests/fixtures/' + name + '.schema.json', 'utf8'));
      const missing = { ...data };
      delete missing.version;
      assert.throws(() => validateFixture(missing, schema), /missing field version/);
      assert.throws(
        () => validateFixture({ ...data, version: String(data.version) }, schema),
        /unsupported value\/version|expected integer/,
      );
      assert.throws(
        () => validateFixture({ ...data, version: Number(data.version) + 1 }, schema),
        /unsupported value\/version/,
      );
    }
  }
});

test('deterministic payment identities are scoped to each fixture instead of shared test order', () => {
  const first = createPaymentFixtureIds();
  const second = createPaymentFixtureIds();
  assert.equal(first(), paymentData.ids[0]);
  assert.equal(first(), paymentData.ids[1]);
  assert.equal(second(), paymentData.ids[0]);
});

test('numeric fixture validation rejects nonfinite and incorrectly typed values', () => {
  const schema = { type: 'number' as const };
  assert.throws(() => validateFixture(Number.NaN, schema), /expected finite number/);
  assert.throws(() => validateFixture(Number.POSITIVE_INFINITY, schema), /expected finite number/);
  assert.throws(
    () => validateFixture(String(paymentData.numbers.amountVnd), schema),
    /expected finite number/,
  );
  validateFixture(paymentData.numbers.amountVnd, schema);
});
