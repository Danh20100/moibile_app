export type RedisConfig =
  | { enabled: false }
  | {
      enabled: true;
      url: string;
      environment: string;
      connectTimeoutMs: number;
    };

export class RedisConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = RedisConfigurationError.name;
  }
}

export function loadRedisConfig(env: NodeJS.ProcessEnv): RedisConfig {
  const url = env.REDIS_URL?.trim();
  if (!url) return { enabled: false };

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new RedisConfigurationError('REDIS_URL must be a valid redis:// or rediss:// URL');
  }
  if (!['redis:', 'rediss:'].includes(parsed.protocol) || !parsed.hostname) {
    throw new RedisConfigurationError('REDIS_URL must be a valid redis:// or rediss:// URL');
  }

  const environment = env.CACHE_ENVIRONMENT?.trim();
  if (!environment || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(environment)) {
    throw new RedisConfigurationError('CACHE_ENVIRONMENT must be a nonempty lowercase environment key');
  }

  const raw = env.REDIS_CONNECT_TIMEOUT_MS ?? '1000';
  if (!/^[1-9]\d*$/.test(raw) || !Number.isSafeInteger(Number(raw))) {
    throw new RedisConfigurationError('REDIS_CONNECT_TIMEOUT_MS must be a positive safe integer');
  }
  return {
    enabled: true,
    url,
    environment,
    connectTimeoutMs: Number(raw),
  };
}
