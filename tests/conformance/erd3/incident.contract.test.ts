import assert from 'node:assert/strict';
import test from 'node:test';

import { readRepoFile, readRepoFiles } from './support/source';

test('Incident categories match frozen ERD3 set', () => {
  const source = readRepoFiles([
    'src/modules/incident/contracts/index.ts',
    'src/modules/incident/dto/index.ts',
  ]);
  for (const category of [
    'electrical',
    'plumbing',
    'access_security',
    'room_facility',
    'appliance',
    'other',
  ]) {
    assert.match(source, new RegExp(category, 'i'), `missing Incident category ${category}`);
  }
  assert.doesNotMatch(source, /category\s*:\s*string/);
  assert.doesNotMatch(source, /internet/i);
});

test('Incident lifecycle matches frozen ERD3 states', () => {
  const source = readRepoFile('src/modules/incident/contracts/index.ts');
  for (const state of ['reported', 'acknowledged', 'in_progress', 'resolved', 'rejected', 'closed']) {
    assert.match(source, new RegExp(state, 'i'), `missing Incident state ${state}`);
  }
  assert.doesNotMatch(source, /['"]processing['"]|need_more_information/i);
});

test('REJECTED and CLOSED are terminal', () => {
  const source = readRepoFile('src/modules/incident/services/incident.service.ts');
  assert.match(source, /rejected\s*:\s*\[\s*\]/i);
  assert.match(source, /closed\s*:\s*\[\s*\]/i);
});

test('RESOLVED can reopen to IN_PROGRESS', () => {
  const source = readRepoFile('src/modules/incident/services/incident.service.ts');
  assert.match(source, /resolved\s*:\s*\[[^\]]*in_progress/is);
});

test('IncidentEvent is a first-class append-only history concept', () => {
  const source = readRepoFiles([
    'src/modules/incident/contracts/index.ts',
    'src/modules/incident/services/incident.service.ts',
  ]);
  assert.match(source, /IncidentEvent/);
  assert.match(source, /append/i);
});
