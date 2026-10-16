import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const clientKeys = [
  'TROOI_API_BASE_URL',
  'TROOI_GOOGLE_WEB_CLIENT_ID',
  'TROOI_MAPS_API_KEY',
  'TROOI_PAYMENT_PUBLIC_ORIGIN',
  'TROOI_RELEASE_PAYMENT_PUBLIC_ORIGIN',
  'TROOI_DEMO_BACKEND_ENABLED',
];

test('Gradle copies only allowlisted Android client settings from the root env file', () => {
  const gradle = readFileSync('app/build.gradle.kts', 'utf8');
  const example = readFileSync('.env.example', 'utf8');
  for (const key of clientKeys) {
    assert.match(gradle, new RegExp(key));
    assert.match(example, new RegExp(`^${key}=`, 'm'));
  }
  assert.match(gradle, /GOOGLE_CLIENT_ID/);
  assert.doesNotMatch(gradle, /SEPAY_SECRET_KEY|POSTGRES_PASSWORD|MINIO_ROOT_PASSWORD|DATABASE_URL/);
});
