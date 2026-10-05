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

export async function resetPublicSchema(databaseUrl: string): Promise<void> {
  if (decodeURIComponent(new URL(databaseUrl).pathname.slice(1)) !== 'trooi_test') {
    throw new Error('Only trooi_test may be reset');
  }
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
