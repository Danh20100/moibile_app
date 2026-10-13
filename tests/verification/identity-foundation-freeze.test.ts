import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('frozen Identity artifacts match exact byte fingerprints and Git clean filters preserve them', () => {
  const root = 'docs/database/vnext/identity-foundation/';
  const manifest = JSON.parse(readFileSync(root + 'freeze-manifest.json', 'utf8')) as {
    freezeVersion: string;
    files: Record<string, string>;
  };
  assert.deepEqual(Object.keys(manifest.files).sort(), [
    'logical.json',
    'physical.json',
    'transaction-contract.md',
  ]);
  for (const [name, expected] of Object.entries(manifest.files)) {
    const file = root + name;
    assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'), expected, file);
    const raw = execFileSync('git', ['hash-object', '--no-filters', file], { encoding: 'utf8' });
    const stored = execFileSync('git', ['hash-object', '--path=' + file, file], {
      encoding: 'utf8',
    });
    assert.equal(stored, raw, file + ': Git commit must preserve exact frozen bytes');
  }
  for (const name of ['logical.json', 'physical.json']) {
    const artifact = JSON.parse(readFileSync(root + name, 'utf8'));
    assert.equal(artifact.status, 'REVIEWED_FROZEN');
    assert.equal(artifact.schemaVersion, manifest.freezeVersion);
  }
});
