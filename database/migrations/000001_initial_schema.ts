import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { MigrationBuilder } from 'node-pg-migrate' with {
  'resolution-mode': 'import',
};

function migrationSql(name: string): string {
  return readFileSync(join(__dirname, 'sql', name), 'utf8');
}

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(migrationSql('000001_initial_schema.up.sql'));
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(migrationSql('000001_initial_schema.down.sql'));
}
