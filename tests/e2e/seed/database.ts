const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const LOCAL_DATABASES = new Set(['trooi_dev', 'trooi_test']);

export function assertSafeE2eDatabaseUrl(value: string | undefined): string {
  if (!value?.trim()) {
    throw new Error('DATABASE_URL is required for E2E seed/reset');
  }

  const parsed = new URL(value);
  const databaseName = parsed.pathname.replace(/^\//, '');

  if (!LOCAL_HOSTS.has(parsed.hostname) || !LOCAL_DATABASES.has(databaseName)) {
    throw new Error(
      `Refusing E2E mutation outside local trooi_dev/trooi_test: ${parsed.hostname}/${databaseName}`,
    );
  }

  return value;
}
