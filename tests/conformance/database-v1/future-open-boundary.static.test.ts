import assert from 'node:assert/strict';
import test from 'node:test';

import { readRepoFile, readRepoFiles } from './support/source';

test('Subscription Pricing Quota is not registered as current core', () => {
  const source = readRepoFile('src/app.module.ts');
  assert.doesNotMatch(source, /\bSubscriptionModule\b/);
});

test('Onboarding bulk import scaffolding is not registered as current core', () => {
  const source = readRepoFile('src/app.module.ts');
  assert.doesNotMatch(source, /\bOnboardingModule\b/);
});

test('CSV Excel import is not documented as current core', () => {
  const source = readRepoFiles([
    'README.md',
    'docs/contexts/project-overview.md',
    'docs/contexts/system-map.md',
    'docs/contexts/end-to-end-flows.md',
    'src/modules/onboarding/README.md',
    'src/modules/onboarding/ARCHITECTURE.md',
  ]);

  assert.match(source, /CSV\/Excel import[\s\S]{0,120}FUTURE|FUTURE[\s\S]{0,120}CSV\/Excel import/i);
  assert.doesNotMatch(source, /CSV\/Excel import[^\n]{0,80}(CURRENT|current core)/i);
});

test('OPEN policies remain explicitly unresolved rather than assigned a boolean default choice', () => {
  const authority = readRepoFile('docs/database/v1/canonical.md');
  const currentDocs = readRepoFiles([
    'README.md',
    'docs/contexts/project-overview.md',
    'docs/contexts/system-map.md',
    'docs/contexts/end-to-end-flows.md',
    'src/modules/audit-trust/README.md',
    'src/modules/audit-trust/ARCHITECTURE.md',
  ]);

  assert.match(authority, /\[OPEN\]/);
  assert.match(currentDocs, /OPEN/);
  assert.doesNotMatch(currentDocs, /trust report[^\n]{0,80}(must be logged in|must be public|requires login: true|requires login: false)/i);
});
