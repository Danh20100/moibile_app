import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseIdentityCutoverManifest,
  runReadOnlyIdentityCutoverPreflight,
  type IdentityCutoverManifest,
} from '../../scripts/identity/cutover-preflight';

const userId = '11111111-1111-4111-8111-111111111111';
const otherUserId = '22222222-2222-4222-8222-222222222222';
const issuer = 'https://accounts.google.com';
const manifest: IdentityCutoverManifest = {
  version: 1,
  principals: [{ issuer: 'accounts.google.com', subject: 'reviewed-subject', userId }],
};

function queryFor(
  options: {
    userExists?: boolean;
    identityRows?: Array<{ user_id: string; issuer: string; subject: string }>;
  } = {},
) {
  const statements: string[] = [];
  const query = async (text: string, values: unknown[] = []) => {
    statements.push(text);
    if (text.startsWith('BEGIN') || text === 'ROLLBACK') return { rows: [] };
    if (text.includes('FROM users'))
      return { rows: options.userExists === false ? [] : [{ user_id: userId }] };
    if (text.includes('FROM auth_identities'))
      return {
        rows: options.identityRows ?? [{ user_id: userId, issuer, subject: 'reviewed-subject' }],
      };
    throw new Error('unexpected query');
  };
  return { query, statements };
}

test('cutover preflight passes only an exact explicit canonical binding without issuing writes', async () => {
  const database = queryFor();
  const bytes = Buffer.from(JSON.stringify(manifest));
  const report = await runReadOnlyIdentityCutoverPreflight(database.query, manifest, bytes);

  assert.equal(report.status, 'PASS');
  assert.equal(report.manifestEntries, 1);
  assert.equal(report.passedEntries, 1);
  assert.equal(report.blockedEntries, 0);
  assert.equal(report.scope, 'supplied_manifest_only');
  assert.match(report.manifestSha256, /^[a-f0-9]{64}$/);
  assert.match(database.statements[0]!, /^BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY$/);
  assert.equal(database.statements.at(-1), 'ROLLBACK');
  assert.ok(database.statements.every((statement) => /^(BEGIN|ROLLBACK|SELECT)\b/.test(statement)));
});

test('preflight blocks missing bindings, mismatched owners, and conflicting user bindings', async () => {
  const missing = queryFor({ userExists: false, identityRows: [] });
  const missingReport = await runReadOnlyIdentityCutoverPreflight(
    missing.query,
    manifest,
    Buffer.from('manifest'),
  );
  assert.equal(missingReport.status, 'BLOCKED');
  assert.deepEqual(missingReport.issues, { missing_user: 1, binding_missing: 1 });

  const mismatch = queryFor({
    identityRows: [{ user_id: otherUserId, issuer, subject: 'reviewed-subject' }],
  });
  const mismatchReport = await runReadOnlyIdentityCutoverPreflight(
    mismatch.query,
    manifest,
    Buffer.from('manifest'),
  );
  assert.equal(mismatchReport.issues.binding_conflict, 1);

  const conflict = queryFor({
    identityRows: [
      { user_id: userId, issuer, subject: 'reviewed-subject' },
      { user_id: userId, issuer, subject: 'other-subject' },
    ],
  });
  const conflictReport = await runReadOnlyIdentityCutoverPreflight(
    conflict.query,
    manifest,
    Buffer.from('manifest'),
  );
  assert.equal(conflictReport.issues.conflicting_user_binding, 1);
});

test('manifest rejects unsupported aliases, malformed ids, and empty input', () => {
  assert.throws(() => parseIdentityCutoverManifest({ version: 1, principals: [] }));
  assert.throws(() =>
    parseIdentityCutoverManifest({
      version: 1,
      principals: [{ ...manifest.principals[0], issuer: 'attacker.example' }],
    }),
  );
  assert.throws(() =>
    parseIdentityCutoverManifest({
      version: 1,
      principals: [{ ...manifest.principals[0], userId: 'not-a-uuid' }],
    }),
  );
  assert.throws(() =>
    parseIdentityCutoverManifest({ ...manifest, reviewer: 'untracked metadata' }),
  );
  assert.throws(() =>
    parseIdentityCutoverManifest({
      version: 1,
      principals: [{ ...manifest.principals[0], subject: 'bad\nsubject' }],
    }),
  );
});

test('duplicate principals and duplicate mapped users block every affected entry', async () => {
  const duplicate: IdentityCutoverManifest = {
    version: 1,
    principals: [
      manifest.principals[0]!,
      { issuer, subject: 'reviewed-subject', userId: otherUserId },
    ],
  };
  const database = queryFor();
  const report = await runReadOnlyIdentityCutoverPreflight(
    database.query,
    duplicate,
    Buffer.from('manifest'),
  );
  assert.equal(report.status, 'BLOCKED');
  assert.equal(report.issues.duplicate_principal, 2);
  assert.equal(report.blockedEntries, 2);

  const duplicateUser: IdentityCutoverManifest = {
    version: 1,
    principals: [manifest.principals[0]!, { issuer, subject: 'another-subject', userId }],
  };
  const duplicateUserReport = await runReadOnlyIdentityCutoverPreflight(
    database.query,
    duplicateUser,
    Buffer.from('manifest'),
  );
  assert.equal(duplicateUserReport.issues.duplicate_user, 2);
  assert.equal(duplicateUserReport.status, 'BLOCKED');
});
