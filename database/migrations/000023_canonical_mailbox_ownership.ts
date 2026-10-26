import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { MigrationBuilder } from 'node-pg-migrate' with {
  'resolution-mode': 'import',
};

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(
    readFileSync(
      join(__dirname, 'sql', '000023_canonical_mailbox_ownership.up.sql'),
      'utf8',
    ),
  );
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(
    readFileSync(
      join(__dirname, 'sql', '000023_canonical_mailbox_ownership.down.sql'),
      'utf8',
    ),
  );
}
