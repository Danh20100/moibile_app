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

test('repository reading order places Canonical v3.7 and frozen ERDs before implementation docs', () => {
  const source = readRepoFile('README.md');
  const canonical = source.indexOf('docs/database/canonical-v3.7.md');
  const lv1 = source.indexOf('trooi-erd-lv1-conceptual.json');
  const projectContext = source.indexOf('docs/PROJECT_CONTEXT.md');
  const implementation = source.indexOf('implementation and tests');

  assert.ok(canonical >= 0, 'README must reference Canonical v3.7');
  assert.ok(lv1 > canonical, 'ERD LV1 must follow Canonical v3.7 in reading order');
  assert.ok(projectContext > lv1, 'project context must come after frozen ERD authority');
  assert.ok(implementation > projectContext, 'implementation must come after project/domain authority');
});

test('historical implementation report declares pre-ERD3 lifecycles superseded', () => {
  const source = readRepoFile('docs/SYSTEM_STRUCTURE_IMPLEMENTATION.md');
  assertContainsAll(source, [
    'HISTORICAL / SUPERSEDED DOMAIN SEMANTICS',
    'docs/database/canonical-v3.7.md',
    'pre-ERD3',
    'not current domain authority',
  ]);
});

test('module docs defer to frozen ERD3 authority', () => {
  for (const path of moduleDocs) {
    const source = readRepoFile(path);
    assert.ok(
      source.includes('Canonical v3.7') && source.includes('ERD3'),
      `${path} must explicitly defer to Canonical v3.7 / ERD3`,
    );
  }
});

test('current docs do not describe Receipt as payment truth', () => {
  const source = readRepoFiles([
    'README.md',
    'docs/PROJECT_CONTEXT.md',
    'docs/SYSTEM_CONTEXT.md',
    'docs/USE_CASES.md',
    'src/modules/receipt/README.md',
    'src/modules/receipt/ARCHITECTURE.md',
  ]);

  assertContainsAll(source, ['Receipt is not the Payment record', 'Payment is actual money inflow']);
  assertContainsNone(source, ['Receipt owns operational payment/receipt record']);
});

test('FUTURE subscription and CSV Excel import are not documented as current core', () => {
  const source = readRepoFiles([
    'README.md',
    'docs/PROJECT_CONTEXT.md',
    'docs/SYSTEM_CONTEXT.md',
    'docs/USE_CASES.md',
    'src/modules/subscription/README.md',
    'src/modules/onboarding/README.md',
  ]);

  assertContainsAll(source, ['Subscription/Pricing/Quota', 'CSV/Excel import', 'FUTURE']);
  assertContainsNone(source, [
    'Subscription/Pricing/Quota is CURRENT',
    'CSV/Excel import is CURRENT',
  ]);
});
