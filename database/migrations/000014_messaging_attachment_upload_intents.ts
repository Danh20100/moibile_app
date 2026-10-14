import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { MigrationBuilder } from 'node-pg-migrate' with { 'resolution-mode': 'import' };

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(readFileSync(join(__dirname, 'sql', '000014_messaging_attachment_upload_intents.up.sql'), 'utf8'));
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.noTransaction();
  pgm.sql(readFileSync(join(__dirname, 'sql', '000014_messaging_attachment_upload_intents.down.sql'), 'utf8'));
}
