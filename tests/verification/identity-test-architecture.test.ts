import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import { businessLiteralFindings, identityTestFiles } from './support/identity-test-governance';
import { loadFixture, validateFixture } from '../support/fixture-loader';
import { loadGooglePrincipals, loadPersistenceScenarios } from '../support/identity-fixtures';

const fixtureNames = [
  'identity/email-normalization',
  'identity/google-principals',
  'identity/persistence-scenarios',
  'identity/legacy-compatibility',
  'identity/payment-seed-claim',
  'rental/identity-reference',
];
test('Identity test/mocks have correct placement and no inline business datasets', () => {
  for (const file of identityTestFiles) {
    assert.match(file, /^tests\/(?:core|integration\/persistence|support)\//);
    if (file.includes('support')) assert.ok(!/\.(?:test|integration)\.ts$/.test(file));
    assert.deepEqual(businessLiteralFindings(file), [], file);
  }
  for (const file of readdirSync('src/common/identity'))
    assert.doesNotMatch(
      file,
      /(?:test|spec|fixture|mock)/,
      'no test-only utilities in new Identity production module',
    );
});
test('all Identity JSON fixtures validate and duplicate datasets/scenarios are rejected', () => {
  const seen = new Set<string>();
  for (const name of fixtureNames) {
    const fixture = loadFixture<Record<string, unknown>>(name);
    assert.ok(Object.isFrozen(fixture), name);
    const encoded = JSON.stringify(fixture);
    assert.ok(!seen.has(encoded), 'duplicate fixture dataset: ' + name);
    seen.add(encoded);
    for (const value of Object.values(fixture))
      if (Array.isArray(value))
        assert.equal(
          new Set(value.map((item) => JSON.stringify(item))).size,
          value.length,
          name + ': duplicate scenarios',
        );
  }
});
test('fixture loader fails clearly on missing fields, wrong types and version, without fallback', () => {
  const fixture = loadPersistenceScenarios();
  const schema = JSON.parse(
    readFileSync('tests/fixtures/identity/persistence-scenarios.schema.json', 'utf8'),
  );
  const missing = structuredClone(fixture) as Partial<typeof fixture>;
  delete missing.version;
  assert.throws(() => validateFixture(missing, schema), /missing field version/);
  assert.throws(
    () => validateFixture({ ...fixture, version: fixture.version + 1 }, schema),
    /unsupported value\/version/,
  );
  assert.throws(
    () =>
      validateFixture(
        {
          ...fixture,
          values: { ...fixture.values, now: fixture.configuration.registrationConcurrency },
        },
        schema,
      ),
    /expected nonempty string/,
  );
  assert.throws(() => loadFixture('identity/missing-fixture'), /ENOENT/);
  const before = fixture.values.now;
  assert.equal(Reflect.set(fixture.values, 'now', fixture.values.later), false);
  assert.equal(fixture.values.now, before);
});
test('focused governance detects injected business literals, unseeded randomness and fallback', () => {
  const fixture = loadGooglePrincipals();
  for (const code of [
    `const injected = ${JSON.stringify(fixture.mockEmail)};`,
    `const record = { subject: ${JSON.stringify(fixture.subjectFirst)} };`,
    'const id = randomUUID();',
    `const value = fixture.email || ${JSON.stringify(fixture.mockEmail)};`,
  ])
    assert.ok(businessLiteralFindings('tests/core/synthetic.test.ts', code).length > 0);
  assert.deepEqual(
    businessLiteralFindings(
      'tests/core/synthetic.test.ts',
      "const sql = 'SELECT user_id FROM users'; const kind = 'uuid';",
    ),
    [],
  );
});
test('vNext integration tests initialize their own DB instead of consuming a previous top-level test', () => {
  const source = readFileSync(
    'tests/integration/persistence/identity-vnext.integration.ts',
    'utf8',
  );
  const callbacks = source.split(/\ntest\(/).slice(1);
  assert.equal(callbacks.length, 4);
  for (const callback of callbacks)
    assert.match(callback, /await initializeIdentityTestDatabase\(/);
  assert.match(source, /t\.beforeEach\(/);
  assert.doesNotMatch(
    readFileSync('tests/integration/persistence/support/identity-vnext-migrations.ts', 'utf8'),
    /git.*show|identityIntegrationBaseline/,
  );
});
