import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, realpathSync, rmSync } from 'node:fs';
import { basename, join, resolve, sep } from 'node:path';
import { runner } from 'node-pg-migrate';
import { resetPublicSchema } from './postgres-test-harness';

export function prepareIdentityMigrationChain(): { dir: string; names: string[] } {
  const dir = resolve('database/migrations');
  const names = readdirSync(dir)
    .filter((file) => /^\d{6}_.*\.ts$/.test(file))
    .sort();
  assert.deepEqual(
    names.map((file) => file.slice(0, 6)),
    Array.from({ length: 8 }, (_, index) => String(index + 1).padStart(6, '0')),
    'Identity release tests require the actual checked-out combined 000001-000008 chain',
  );
  return { dir, names: names.map((file) => basename(file, '.ts')) };
}
export async function initializeIdentityTestDatabase(url: string, count?: number): Promise<void> {
  const { dir } = prepareIdentityMigrationChain();
  await resetPublicSchema(url);
  await runner({
    databaseUrl: url,
    dir,
    direction: 'up',
    count,
    migrationsTable: 'schema_migrations',
    checkOrder: true,
    log: () => undefined,
  });
}
export function prepareMissingPredecessorChain(): { dir: string; cleanup: () => void } {
  const { dir } = prepareIdentityMigrationChain();
  const parent = resolve('test-results/profile-foundation');
  mkdirSync(parent, { recursive: true });
  const root = mkdtempSync(join(parent, 'identity-incomplete-chain-'));
  mkdirSync(join(root, 'sql'));
  for (const file of readdirSync(dir).filter((file) => /^00000[1-58]_.*\.ts$/.test(file))) {
    copyFileSync(join(dir, file), join(root, file));
  }
  for (const file of readdirSync(join(dir, 'sql')).filter((file) =>
    /^00000[1-58]_.*\.(?:up|down)\.sql$/.test(file),
  ))
    copyFileSync(join(dir, 'sql', file), join(root, 'sql', file));

  return {
    dir: root,
    cleanup: () => {
      assert.ok(realpathSync(root).startsWith(realpathSync(parent) + sep));
      rmSync(root, { recursive: true });
    },
  };
}
