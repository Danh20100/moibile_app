export interface DatabaseConfig {
  url: string;
  maxPoolSize: number;
  connectionTimeoutMs: number;
}

export class DatabaseConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = DatabaseConfigurationError.name;
  }
}

function requiredPostgresUrl(value: string | undefined): string {
  const url = value?.trim();
  if (!url) {
    throw new DatabaseConfigurationError('DATABASE_URL is required');
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
      throw new Error('unsupported protocol');
    }
  } catch {
    throw new DatabaseConfigurationError(
      'DATABASE_URL must be a valid PostgreSQL URL',
    );
  }
  return url;
}

function positiveInteger(
  name: string,
  value: string | undefined,
  defaultValue: number,
): number {
  if (value === undefined) return defaultValue;
  if (!/^\d+$/.test(value)) {
    throw new DatabaseConfigurationError(`${name} must be a positive integer`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new DatabaseConfigurationError(`${name} must be a positive integer`);
  }
  return parsed;
}

export function loadDatabaseConfig(env: NodeJS.ProcessEnv): DatabaseConfig {
  return {
    url: requiredPostgresUrl(env.DATABASE_URL),
    maxPoolSize: positiveInteger('DATABASE_POOL_MAX', env.DATABASE_POOL_MAX, 10),
    connectionTimeoutMs: positiveInteger(
      'DATABASE_CONNECTION_TIMEOUT_MS',
      env.DATABASE_CONNECTION_TIMEOUT_MS,
      5000,
    ),
  };
}
