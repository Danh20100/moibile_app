import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('plain docker compose up starts TrọƠi and CompreFace as one default project', () => {
  const compose = readFileSync('docker-compose.yml', 'utf8').replaceAll('\r\n', '\n');
  const required = [
    'postgres', 'backend', 'redis', 'minio', 'minio-init',
    'compreface-postgres-db', 'compreface-core',
    'compreface-api', 'compreface-admin', 'compreface-fe',
  ];
  for (const name of required) {
    const prefix = '\n  ' + name + ':\n';
    const start = compose.indexOf(prefix);
    assert.notEqual(start, -1, 'Missing default service: ' + name);
    const tail = compose.slice(start + prefix.length);
    const end = tail.search(/\n  [a-z][a-z0-9-]*:\n|\nnetworks:\n|\nvolumes:\n/);
    const definition = end < 0 ? tail : tail.slice(0, end);
    assert.doesNotMatch(definition, /^    profiles:/m, name + ' must not require a profile');
    assert.match(definition, /networks: \[trooi-network\]/, name + ' must share private network');
  }
  assert.match(compose, /SAVE_IMAGES_TO_DB: "false"/);
  assert.match(compose, /compreface_postgres_data:\/var\/lib\/postgresql\/data/);
  assert.match(compose, /COMPREFACE_API_KEY: \$\{COMPREFACE_API_KEY:-\}/);
  const legacy = readFileSync('scripts/dev/connect-local-kyc-lab.ps1', 'utf8');
  assert.doesNotMatch(legacy, /docker network connect|docker compose -p trooi-verify-lab/);
  assert.match(legacy, /docker compose up -d/);
});
