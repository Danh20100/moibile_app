import assert from 'node:assert/strict';
import { Client } from 'pg';
import test from 'node:test';

import {
  parseIdentityCutoverManifest,
  runReadOnlyIdentityCutoverPreflight,
} from '../../../scripts/identity/cutover-preflight';
import { initializeIdentityTestDatabase } from './support/identity-vnext-migrations';
import { assertSafeTestDatabaseUrl } from './support/postgres-test-harness';

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';
const ISSUER = 'https://accounts.google.com';

test('cutover preflight reads explicit bindings from isolated PostgreSQL without writes', async (context) => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) return context.skip('isolated TEST_DATABASE_URL required');
  assertSafeTestDatabaseUrl(url);
  await initializeIdentityTestDatabase(url, 8);

  const setup = new Client({ connectionString: url });
  await setup.connect();
  try {
    await setup.query('INSERT INTO users(user_id) VALUES ($1), ($2)', [USER_A, USER_B]);
    await setup.query(
      'INSERT INTO auth_identities(auth_identity_id,user_id,provider,issuer,subject,linked_at) VALUES ($1,$2,$3,$4,$5,now())',
      ['ad000000-0000-4000-8000-000000000001', USER_A, 'google', ISSUER, 'preflight-bound-subject'],
    );
  } finally {
    await setup.end();
  }

  const manifestBytes = Buffer.from(
    JSON.stringify({
      version: 1,
      principals: [
        { issuer: 'accounts.google.com', subject: 'preflight-bound-subject', userId: USER_A },
      ],
    }),
  );
  const manifest = parseIdentityCutoverManifest(
    JSON.parse(manifestBytes.toString('utf8')) as unknown,
  );
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const beforeUsers = await client.query('SELECT user_id FROM users ORDER BY user_id');
    const beforeBindings = await client.query(
      'SELECT user_id, issuer, subject FROM auth_identities ORDER BY auth_identity_id',
    );
    const report = await runReadOnlyIdentityCutoverPreflight(
      (text, values) => client.query(text, values),
      manifest,
      manifestBytes,
    );
    assert.equal(report.status, 'PASS');
    assert.equal(report.passedEntries, 1);
    assert.equal(report.blockedEntries, 0);

    const blockedManifest = parseIdentityCutoverManifest({
      version: 1,
      principals: [{ issuer: ISSUER, subject: 'unbound-subject', userId: USER_B }],
    });
    const blocked = await runReadOnlyIdentityCutoverPreflight(
      (text, values) => client.query(text, values),
      blockedManifest,
      Buffer.from('unbound manifest'),
    );
    assert.equal(blocked.status, 'BLOCKED');
    assert.equal(blocked.issues.binding_missing, 1);

    assert.deepEqual(await client.query('SELECT user_id FROM users ORDER BY user_id'), beforeUsers);
    assert.deepEqual(
      await client.query(
        'SELECT user_id, issuer, subject FROM auth_identities ORDER BY auth_identity_id',
      ),
      beforeBindings,
    );
  } finally {
    await client.end();
  }
});
