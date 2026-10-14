import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';

export interface PhysicalCatalog {
  tables: string[];
  primaryKeys: string[];
  foreignKeys: string[];
  checks: string[];
  uniqueConstraints: string[];
  indexes: string[];
}

const LOCAL_TEST_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

export function assertSafeTestDatabaseUrl(databaseUrl: string): string {
  const parsed = new URL(databaseUrl);
  const databaseName = decodeURIComponent(parsed.pathname.slice(1));
  if (!LOCAL_TEST_HOSTS.has(parsed.hostname) || databaseName !== 'trooi_test') {
    throw new Error('Only a local trooi_test database may be reset');
  }
  return databaseUrl;
}

export async function resetPublicSchema(databaseUrl: string): Promise<void> {
  assertSafeTestDatabaseUrl(databaseUrl);
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query('DROP SCHEMA IF EXISTS gateway CASCADE; DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;');
  } finally {
    await client.end();
  }
}

export async function queryCatalog(
  databaseUrl: string,
): Promise<PhysicalCatalog> {
  const sql = readFileSync(
    join(process.cwd(), 'scripts', 'database', 'physical_contract_catalog.sql'),
    'utf8',
  );
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const result = await client.query<{ json_build_object: PhysicalCatalog }>(sql);
    const catalog = result.rows[0]?.json_build_object;
    if (!catalog) throw new Error('Catalog query returned no rows');
    return catalog;
  } finally {
    await client.end();
  }
}
