import { join } from 'node:path';

export async function runMigrations(
  direction: 'up' | 'down',
  databaseUrl: string,
): Promise<void> {
  const { runner } = await import('node-pg-migrate');
  await runner({
    databaseUrl,
    direction,
    count: direction === 'down' ? 1 : undefined,
    dir: join(process.cwd(), 'database', 'migrations'),
    migrationsTable: 'schema_migrations',
    checkOrder: true,
  });
}

async function main(): Promise<void> {
  const direction = process.argv[2] === 'down' ? 'down' : 'up';
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  await runMigrations(direction, databaseUrl);
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Migration failed');
    process.exitCode = 1;
  });
}
