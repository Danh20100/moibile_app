import type { MigrationBuilder } from 'node-pg-migrate';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const shorthands = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(readFileSync(join(__dirname, 'sql', '000011_listing_asset_media.up.sql'), 'utf8'));
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(readFileSync(join(__dirname, 'sql', '000011_listing_asset_media.down.sql'), 'utf8'));
}
