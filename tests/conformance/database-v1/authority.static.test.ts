import assert from 'node:assert/strict';
import test from 'node:test';

import { assertContainsAll, assertContainsNone, readRepoFile, readRepoFiles } from './support/source';

const moduleDocs = [
  'src/modules/identity-access/README.md',
  'src/modules/identity-access/ARCHITECTURE.md',
  'src/modules/organization/README.md',
  'src/modules/organization/ARCHITECTURE.md',
  'src/modules/property/README.md',
  'src/modules/property/ARCHITECTURE.md',
  'src/modules/room/README.md',
  'src/modules/room/ARCHITECTURE.md',
  'src/modules/listing/README.md',
  'src/modules/listing/ARCHITECTURE.md',
  'src/modules/tenancy/README.md',
  'src/modules/tenancy/ARCHITECTURE.md',
  'src/modules/billing/README.md',
  'src/modules/billing/ARCHITECTURE.md',
  'src/modules/receipt/README.md',
  'src/modules/receipt/ARCHITECTURE.md',
  'src/modules/incident/README.md',
  'src/modules/incident/ARCHITECTURE.md',
  'src/modules/audit-trust/README.md',
  'src/modules/audit-trust/ARCHITECTURE.md',
  'src/modules/subscription/README.md',
  'src/modules/subscription/ARCHITECTURE.md',
  'src/modules/onboarding/README.md',
  'src/modules/onboarding/ARCHITECTURE.md',
] as const;

test('repository reading order places Database v1 canonical and frozen ERDs before implementation docs', () => {
  const source = readRepoFile('README.md');
  const canonical = source.indexOf('docs/database/v1/canonical.md');
  const conceptualContract = source.indexOf('docs/database/v1/erd/conceptual.json');
  const contexts = source.indexOf('docs/contexts/');
  const implementation = source.indexOf('implementation and tests');

  assert.ok(canonical >= 0, 'README must reference Database v1 canonical');
  assert.ok(
    conceptualContract > canonical,
    'ERD conceptual must follow canonical in reading order',
  );
  assert.ok(
    contexts > conceptualContract,
    'shared contexts must come after frozen ERD authority',
  );
  assert.ok(implementation > contexts, 'implementation must come after domain authority');
});

test('database implementation history is provenance that defers to canonical authority', () => {
  const source = readRepoFile('docs/database/v1/implementation-history.md');
  assertContainsAll(source, [
    'provenance',
    'không override',
    'canonical.md',
  ]);
});

test('module docs defer to frozen Database v1 authority', () => {
  for (const path of moduleDocs) {
    const source = readRepoFile(path);
    assert.ok(
      source.includes('Canonical v3.7') &&
        (source.includes('Database v1') || source.includes('database-v1')),
      `${path} must explicitly defer to Canonical v3.7 / Database v1`,
    );
  }
});

test('current docs do not describe Receipt as payment truth', () => {
  const source = readRepoFiles([
    'README.md',
    'src/modules/receipt/README.md',
    'src/modules/receipt/ARCHITECTURE.md',
  ]);

  assertContainsAll(source, ['Receipt is not the Payment record', 'Payment is actual money inflow']);
  assertContainsNone(source, ['Receipt owns operational payment/receipt record']);
});

test('FUTURE subscription and CSV Excel import are not documented as current core', () => {
  const source = readRepoFiles([
    'README.md',
    'src/modules/subscription/README.md',
    'src/modules/onboarding/README.md',
  ]);

  assertContainsAll(source, ['Subscription/Pricing/Quota', 'CSV/Excel import', 'FUTURE']);
  assertContainsNone(source, [
    'Subscription/Pricing/Quota is CURRENT',
    'CSV/Excel import is CURRENT',
  ]);
});
