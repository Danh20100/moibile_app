import { Kysely, PostgresDialect } from 'kysely';
import { Pool, types } from 'pg';

import type { DatabaseConfig } from './database.config';
import type { Database } from './schema.types';

const DATE_OID = 1082;
const TIMESTAMPTZ_OID = 1184;
const NUMERIC_OID = 1700;

function configureScalarParsers(): void {
  types.setTypeParser(DATE_OID, (value: string) => value);
  types.setTypeParser(NUMERIC_OID, (value: string) => value);
  types.setTypeParser(TIMESTAMPTZ_OID, (value: string) =>
    new Date(value).toISOString(),
  );
}

export function createDatabaseClient(config: DatabaseConfig): Kysely<Database> {
  configureScalarParsers();
  return new Kysely<Database>({
    dialect: new PostgresDialect({
      pool: new Pool({
        connectionString: config.url,
        max: config.maxPoolSize,
        connectionTimeoutMillis: config.connectionTimeoutMs,
      }),
    }),
  });
}
