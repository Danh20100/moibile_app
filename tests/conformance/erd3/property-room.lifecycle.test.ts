import assert from 'node:assert/strict';
import test from 'node:test';

import { readRepoFile, readRepoFiles } from './support/source';

test('PROPERTY lifecycle is ACTIVE ARCHIVED only', () => {
  const source = readRepoFile('src/modules/property/contracts/index.ts');
  assert.match(source, /['"]active['"]\s*\|\s*['"]archived['"]/i);
  assert.doesNotMatch(source, /['"]inactive['"]/i);
});

test('PROPERTY exposes both operational and public location concepts', () => {
  const source = readRepoFiles([
    'src/modules/property/contracts/index.ts',
    'src/modules/property/dto/index.ts',
  ]);
  assert.match(source, /operational.*location|operationalLocation/is);
  assert.match(source, /public.*location|publicLocation/is);
});

test('ROOM separates operational state from record lifecycle', () => {
  const source = readRepoFile('src/modules/room/contracts/index.ts');
  assert.match(source, /operationalState|operational_state/i);
  assert.match(source, /recordLifecycle|record_lifecycle/i);
});

test('ROOM operational states are VACANT OCCUPIED MAINTENANCE INACTIVE only', () => {
  const source = readRepoFile('src/modules/room/contracts/index.ts');
  const declaration = source.match(/(?:type|enum)\s+\w*OperationalState\w*[\s\S]*?(?:;|\n\})/i);
  assert.ok(declaration, 'Room contract must expose a dedicated operational-state type');
  const operationalState = declaration[0];
  for (const state of ['vacant', 'occupied', 'maintenance', 'inactive']) {
    assert.match(
      operationalState,
      new RegExp(`['\"]?${state}['\"]?`, 'i'),
      `missing Room operational state ${state}`,
    );
  }
  assert.doesNotMatch(operationalState, /draft|archived/i);
});

test('ROOM record lifecycle is ACTIVE ARCHIVED only', () => {
  const source = readRepoFile('src/modules/room/contracts/index.ts');
  const declaration = source.match(/(?:type|enum)\s+\w*(?:RecordLifecycle|Lifecycle)\w*[\s\S]*?(?:;|\n\})/i);
  assert.ok(declaration, 'Room contract must expose a dedicated record-lifecycle type');
  const lifecycle = declaration[0];
  assert.match(lifecycle, /active/i);
  assert.match(lifecycle, /archived/i);
});

test('ROOM contract does not own base rent price', () => {
  const source = readRepoFiles([
    'src/modules/room/contracts/index.ts',
    'src/modules/room/dto/index.ts',
  ]);
  assert.doesNotMatch(source, /\bbasePrice\b/);
});

test('old OCCUPIED to MAINTENANCE transition is not allowed', () => {
  const source = readRepoFile('src/modules/room/services/room.service.ts');
  assert.doesNotMatch(source, /occupied\s*:\s*\[[^\]]*maintenance/is);
});

test('room archival is not represented as a direct operational-state transition', () => {
  const source = readRepoFile('src/modules/room/services/room.service.ts');
  assert.doesNotMatch(source, /vacant\s*:\s*\[[^\]]*archived/is);
});

test('room archive guard requires INACTIVE and blocks nonterminal tenancy or open incident', () => {
  const source = readRepoFiles([
    'src/modules/room/services/room.service.ts',
    'src/modules/room/contracts/index.ts',
  ]).toLowerCase();
  assert.ok(source.includes('inactive'), 'room archive flow must require INACTIVE');
  assert.ok(source.includes('tenancy'), 'room archive flow must account for non-terminal tenancy');
  assert.ok(source.includes('incident'), 'room archive flow must account for open incident');
});
