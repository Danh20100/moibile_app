import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { validateFixture } from '../support/fixture-loader';

const cases = [
  {
    fixture: 'network/checkout-transport',
    source: 'core/network/CheckoutTransportTest.kt',
    count: 9,
  },
  { fixture: 'model/contract-boundary', source: 'core/model/ContractBoundaryTest.kt', count: 4 },
  { fixture: 'tenancy/checkout-flow', source: 'features/tenancy/CheckoutFlowTest.kt', count: 12 },
];
const root = resolve('tests/android/unit/resources/fixtures');
const read = (name: string) => JSON.parse(readFileSync(resolve(root, name), 'utf8'));

test('affected Android payment fixtures validate against their versioned exact schemas', () => {
  for (const entry of cases) {
    const fixture = read(`${entry.fixture}.json`);
    const schema = read(`${entry.fixture}.schema.json`);
    assert.equal(fixture.version, 1);
    assert.equal(schema.additionalProperties, false);
    assert.deepEqual(new Set(schema.required), new Set(Object.keys(schema.properties)));
    validateFixture(fixture, schema, entry.fixture);
  }
});

test('affected Android fixture schemas reject missing fields, wrong types, versions and nested items', () => {
  for (const entry of cases) {
    const fixture = read(`${entry.fixture}.json`);
    const schema = read(`${entry.fixture}.schema.json`);
    const firstField = Object.keys(fixture).find((key) => key !== 'version')!;
    const missing = structuredClone(fixture);
    delete missing[firstField];
    const wrongType = structuredClone(fixture);
    wrongType[firstField] = [];
    const wrongVersion = structuredClone(fixture);
    wrongVersion.version += 1;
    const unknownField = { ...fixture, unexpected: true };
    for (const invalid of [missing, wrongType, wrongVersion, unknownField]) {
      assert.throws(() => validateFixture(invalid, schema, entry.fixture));
    }
  }
  const flow = read('tenancy/checkout-flow.json');
  flow.invalidDemoUrls.push(true);
  assert.throws(() => validateFixture(flow, read('tenancy/checkout-flow.schema.json')));
  const contract = read('model/contract-boundary.json');
  contract.unknownOutstanding = [];
  assert.throws(() => validateFixture(contract, read('model/contract-boundary.schema.json')));
});

test('the three affected Android classes use validated fixtures without inline semantic datasets', () => {
  // Deliberately scoped to these changed classes; protocol paths, field names and methods stay in code.
  const businessLiteral =
    /(?:^\d+\.\d{2}$|^[a-z]+:\/\/|^\d{4}-\d{2}-\d{2}T|^[0-9a-f]{8}-[0-9a-f]{4}-|^(?:my|foreign|key)-|^(?:chk|pay|ref|t|c|p)-?\d+$|^(?:SUCCEEDED|CREATED|FAILED|INITIATED|UNKNOWN|PROVIDER_DISABLED|MOMO|SEPAY|DEMO|RENT|WATER|MANUAL_CASH|USER_RECORDED|ENDING|active|ended|cancelled)$)/;
  for (const entry of cases) {
    const source = readFileSync(
      resolve('tests/android/unit/java/com/trooi/app', entry.source),
      'utf8',
    );
    assert.match(source, /import com\.trooi\.app\.support\.JsonFixtures/);
    assert.ok(source.includes(`JsonFixtures.load("${entry.fixture}")`));
    assert.equal((source.match(/@Test\b/g) ?? []).length, entry.count);
    const strings = [...source.matchAll(/"([^"\\]*(?:\\.[^"\\]*)*)"/g)].map((match) => match[1]);
    for (const literal of strings)
      assert.equal(businessLiteral.test(literal), false, `${entry.source}: ${literal}`);
  }
});
