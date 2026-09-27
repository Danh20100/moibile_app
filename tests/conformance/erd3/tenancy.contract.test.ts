import assert from 'node:assert/strict';
import test from 'node:test';

import { readRepoFile, readRepoFiles } from './support/source';

test('TENANCY lifecycle matches frozen ERD3 transitions', () => {
  const contract = readRepoFile('src/modules/tenancy/contracts/index.ts');
  const service = readRepoFile('src/modules/tenancy/services/tenancy.service.ts');

  for (const state of ['draft', 'active', 'ending', 'ended', 'cancelled']) {
    assert.match(contract, new RegExp(`['\"]${state}['\"]`, 'i'), `missing Tenancy state ${state}`);
  }
  assert.match(service, /draft\s*:\s*\[[^\]]*active[^\]]*cancelled|draft\s*:\s*\[[^\]]*cancelled[^\]]*active/is);
  assert.match(service, /ending\s*:\s*\[[^\]]*active[^\]]*ended|ending\s*:\s*\[[^\]]*ended[^\]]*active/is);
  assert.doesNotMatch(service, /active\s*:\s*\[[^\]]*ended/is);
});

test('TENANCY does not embed tenantId as participant truth', () => {
  const source = readRepoFiles([
    'src/modules/tenancy/contracts/index.ts',
    'src/modules/tenancy/dto/index.ts',
  ]);
  assert.doesNotMatch(source, /\btenantId\b/);
});

test('TenancyParticipant is a first-class concept with optional USER link', () => {
  const source = readRepoFile('src/modules/tenancy/contracts/index.ts');
  assert.match(source, /TenancyParticipant/);
  assert.match(source, /PRIMARY/);
  assert.match(source, /OCCUPANT/);
  assert.match(source, /userId\??\s*:/);
});

test('TenancyTerms is first-class and versioned rather than embedded mutable terms', () => {
  const source = readRepoFile('src/modules/tenancy/contracts/index.ts');
  assert.match(source, /TenancyTerms/);
  assert.match(source, /version/i);
  assert.doesNotMatch(source, /\bterms\s*:\s*TenancyTerms\b/);
});

test('Terms acknowledgement is version-specific', () => {
  const source = readRepoFile('src/modules/tenancy/contracts/index.ts');
  assert.match(source, /TermsAcknowledg/i);
  assert.match(source, /termsVersion|tenancyTermsId|terms_id/i);
});

test('Room has at most one non-terminal Tenancy', () => {
  const source = readRepoFile('src/modules/tenancy/services/tenancy.service.ts').toLowerCase();
  assert.ok(
    source.includes('non-terminal') || source.includes('nonterminal'),
    'Tenancy creation must expose the one-non-terminal-tenancy-per-Room guard',
  );
});

test('ENDING tenancy blocks creation of a next DRAFT tenancy for the Room', () => {
  const source = readRepoFile('src/modules/tenancy/services/tenancy.service.ts').toLowerCase();
  assert.ok(source.includes('ending'), 'guard must account for ENDING tenancy');
  assert.ok(
    source.includes('next draft') || source.includes('draft tenancy') || source.includes('non-terminal') || source.includes('nonterminal'),
    'guard must block a next DRAFT while ENDING exists',
  );
});

test('checkout workflow couples ENDING to ENDED with Room becoming VACANT', () => {
  const source = readRepoFiles([
    'src/modules/tenancy/services/tenancy.service.ts',
    'src/modules/room/services/room.service.ts',
  ]).toLowerCase();
  assert.ok(source.includes('checkout'), 'checkout must be an explicit workflow');
  assert.ok(source.includes('ending') && source.includes('ended'), 'checkout must end an ENDING tenancy');
  assert.ok(source.includes('vacant'), 'checkout must return Room to VACANT');
});
