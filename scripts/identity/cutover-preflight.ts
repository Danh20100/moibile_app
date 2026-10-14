import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Client } from 'pg';

const CANONICAL_ISSUER = 'https://accounts.google.com';
const ISSUER_ALIASES = ['accounts.google.com', CANONICAL_ISSUER];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface IdentityCutoverManifest {
  version: 1;
  principals: Array<{ issuer: string; subject: string; userId: string }>;
}

export type CutoverIssue =
  | 'duplicate_principal'
  | 'duplicate_user'
  | 'missing_user'
  | 'binding_missing'
  | 'binding_conflict'
  | 'conflicting_user_binding';

export interface IdentityCutoverReport {
  status: 'PASS' | 'BLOCKED';
  scope: 'supplied_manifest_only';
  manifestSha256: string;
  manifestEntries: number;
  passedEntries: number;
  blockedEntries: number;
  issues: Partial<Record<CutoverIssue, number>>;
}

type Query = (sql: string, values?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;

export function parseIdentityCutoverManifest(value: unknown): IdentityCutoverManifest {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('invalid manifest');
  const record = value as Record<string, unknown>;
  if (Object.keys(record).sort().join(',') !== 'principals,version')
    throw new Error('invalid manifest');
  if (
    record.version !== 1 ||
    !Array.isArray(record.principals) ||
    record.principals.length === 0 ||
    record.principals.length > 10000
  )
    throw new Error('invalid manifest');
  const principals = record.principals.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item))
      throw new Error('invalid manifest');
    const principal = item as Record<string, unknown>;
    if (Object.keys(principal).sort().join(',') !== 'issuer,subject,userId')
      throw new Error('invalid manifest');
    if (
      typeof principal.issuer !== 'string' ||
      !ISSUER_ALIASES.includes(principal.issuer) ||
      typeof principal.subject !== 'string' ||
      principal.subject.length === 0 ||
      principal.subject.length > 255 ||
      !/^[\x21-\x7e]+$/.test(principal.subject) ||
      principal.subject !== principal.subject.trim() ||
      typeof principal.userId !== 'string' ||
      !UUID.test(principal.userId)
    )
      throw new Error('invalid manifest');
    return { issuer: principal.issuer, subject: principal.subject, userId: principal.userId };
  });
  return { version: 1, principals };
}

export async function inspectIdentityCutoverManifest(
  query: Query,
  manifest: IdentityCutoverManifest,
  manifestBytes: Buffer,
): Promise<IdentityCutoverReport> {
  const issuesByEntry = manifest.principals.map(() => new Set<CutoverIssue>());
  const principals = new Map<string, number[]>();
  const users = new Map<string, number[]>();
  manifest.principals.forEach((entry, index) => {
    const principalKey = `${CANONICAL_ISSUER}\0${entry.subject}`;
    principals.set(principalKey, [...(principals.get(principalKey) ?? []), index]);
    users.set(entry.userId.toLowerCase(), [
      ...(users.get(entry.userId.toLowerCase()) ?? []),
      index,
    ]);
  });
  for (const indexes of principals.values())
    if (indexes.length > 1)
      indexes.forEach((index) => issuesByEntry[index]!.add('duplicate_principal'));
  for (const indexes of users.values())
    if (indexes.length > 1) indexes.forEach((index) => issuesByEntry[index]!.add('duplicate_user'));

  const userIds = [...new Set(manifest.principals.map(({ userId }) => userId.toLowerCase()))];
  const subjects = [...new Set(manifest.principals.map(({ subject }) => subject))];
  const userRows = await query('SELECT user_id FROM users WHERE user_id = ANY($1::uuid[])', [
    userIds,
  ]);
  const identityRows = await query(
    "SELECT user_id, issuer, subject FROM auth_identities WHERE provider = 'google' AND issuer = ANY($1::text[]) AND (subject = ANY($2::text[]) OR user_id = ANY($3::uuid[]))",
    [ISSUER_ALIASES, subjects, userIds],
  );
  const existingUserIds = new Set(
    userRows.rows.map(({ user_id }) => String(user_id).toLowerCase()),
  );
  for (const [index, entry] of manifest.principals.entries()) {
    if (!existingUserIds.has(entry.userId.toLowerCase())) issuesByEntry[index]!.add('missing_user');

    const principalRows = identityRows.rows.filter(
      (row) => row.subject === entry.subject && ISSUER_ALIASES.includes(String(row.issuer)),
    );
    if (principalRows.length === 0) issuesByEntry[index]!.add('binding_missing');
    else if (
      principalRows.length !== 1 ||
      String(principalRows[0]!.user_id).toLowerCase() !== entry.userId.toLowerCase() ||
      principalRows[0]!.issuer !== CANONICAL_ISSUER ||
      principalRows[0]!.subject !== entry.subject
    )
      issuesByEntry[index]!.add('binding_conflict');

    const userBindings = identityRows.rows.filter(
      (binding) => String(binding.user_id).toLowerCase() === entry.userId.toLowerCase(),
    );
    if (
      userBindings.some(
        (binding) => binding.issuer !== CANONICAL_ISSUER || binding.subject !== entry.subject,
      )
    )
      issuesByEntry[index]!.add('conflicting_user_binding');
  }

  const issueCounts: Partial<Record<CutoverIssue, number>> = {};
  for (const issues of issuesByEntry)
    for (const issue of issues) issueCounts[issue] = (issueCounts[issue] ?? 0) + 1;
  const blockedEntries = issuesByEntry.filter((issues) => issues.size > 0).length;
  return {
    status: blockedEntries === 0 ? 'PASS' : 'BLOCKED',
    scope: 'supplied_manifest_only',
    manifestSha256: createHash('sha256').update(manifestBytes).digest('hex'),
    manifestEntries: manifest.principals.length,
    passedEntries: manifest.principals.length - blockedEntries,
    blockedEntries,
    issues: issueCounts,
  };
}

export async function runReadOnlyIdentityCutoverPreflight(
  query: Query,
  manifest: IdentityCutoverManifest,
  manifestBytes: Buffer,
): Promise<IdentityCutoverReport> {
  await query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try {
    const report = await inspectIdentityCutoverManifest(query, manifest, manifestBytes);
    await query('ROLLBACK');
    return report;
  } catch (error) {
    await query('ROLLBACK');
    throw error;
  }
}

async function main(): Promise<void> {
  if (process.env.TROOI_IDENTITY_PREFLIGHT_READ_ONLY !== '1')
    throw new Error('read-only preflight acknowledgement required');
  if (process.env.TROOI_IDENTITY_FOUNDATION_RESOLUTION_ENABLED === 'true')
    throw new Error('Identity runtime gate must remain off');
  const databaseUrl = process.env.IDENTITY_PREFLIGHT_DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error('IDENTITY_PREFLIGHT_DATABASE_URL is required');
  const manifestArg = process.argv.indexOf('--manifest');
  const manifestPath = manifestArg >= 0 ? process.argv[manifestArg + 1] : undefined;
  if (!manifestPath) throw new Error('--manifest path is required');

  const manifestBytes = await readFile(manifestPath);
  if (manifestBytes.byteLength > 1_000_000) throw new Error('manifest exceeds size limit');
  const manifest = parseIdentityCutoverManifest(
    JSON.parse(manifestBytes.toString('utf8')) as unknown,
  );
  const client = new Client({
    connectionString: databaseUrl,
    application_name: 'trooi-identity-cutover-preflight-read-only',
  });
  const target = new URL(databaseUrl);
  await client.connect();
  try {
    const preflight = await runReadOnlyIdentityCutoverPreflight(
      (text, values) => client.query(text, values),
      manifest,
      manifestBytes,
    );
    const report = {
      ...preflight,
      databaseHost: target.hostname,
      databaseName: decodeURIComponent(target.pathname.slice(1)),
    };
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (report.status !== 'PASS') process.exitCode = 1;
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  void main().catch(() => {
    process.stderr.write(
      'Identity cutover preflight failed closed; no database changes were made.\n',
    );
    process.exitCode = 2;
  });
}
