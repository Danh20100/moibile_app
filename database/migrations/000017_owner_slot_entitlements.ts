import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { MigrationBuilder } from 'node-pg-migrate' with { 'resolution-mode': 'import' };

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(readFileSync(join(__dirname, 'sql', '000017_owner_slot_entitlements.up.sql'), 'utf8'));
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.noTransaction();
  pgm.sql(readFileSync(join(__dirname, 'sql', '000017_owner_slot_entitlements.down.sql'), 'utf8'));
}
