export type ObjectStorageConfig =
  | { enabled: false }
  | {
      enabled: true;
      endpoint: string;
      region: string;
      bucket: string;
      accessKey: string;
      secretKey: string;
      forcePathStyle: boolean;
    };

export class ObjectStorageConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = ObjectStorageConfigurationError.name;
  }
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new ObjectStorageConfigurationError(`${name} is required when object storage is enabled`);
  }
  return value;
}

function booleanValue(value: string | undefined): boolean {
  if (value === undefined || value === '') return true;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new ObjectStorageConfigurationError('OBJECT_STORAGE_FORCE_PATH_STYLE must be true or false');
}

export function loadObjectStorageConfig(env: NodeJS.ProcessEnv): ObjectStorageConfig {
  const enabled = env.OBJECT_STORAGE_ENABLED?.trim() ?? '';
  if (!enabled || enabled === 'false') return { enabled: false };
  if (enabled !== 'true') {
    throw new ObjectStorageConfigurationError('OBJECT_STORAGE_ENABLED must be true or false');
  }

  const endpoint = required(env, 'OBJECT_STORAGE_ENDPOINT');
  let parsed: URL;
  try {
    parsed = new URL(endpoint);
  } catch {
    throw new ObjectStorageConfigurationError('OBJECT_STORAGE_ENDPOINT must be an absolute HTTP(S) URL');
  }
  if (
    !['http:', 'https:'].includes(parsed.protocol) ||
    !parsed.hostname ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    parsed.pathname !== '/'
  ) {
    throw new ObjectStorageConfigurationError('OBJECT_STORAGE_ENDPOINT must be an HTTP(S) origin without credentials, path or query');
  }

  const bucket = required(env, 'OBJECT_STORAGE_BUCKET');
  if (
    bucket.length < 3 ||
    bucket.length > 63 ||
    !/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/.test(bucket) ||
    bucket.includes('..') ||
    bucket.includes('.-') ||
    bucket.includes('-.')
  ) {
    throw new ObjectStorageConfigurationError('OBJECT_STORAGE_BUCKET must be an S3-compatible bucket name');
  }

  return {
    enabled: true,
    endpoint: parsed.origin,
    region: required(env, 'OBJECT_STORAGE_REGION'),
    bucket,
    accessKey: required(env, 'OBJECT_STORAGE_ACCESS_KEY'),
    secretKey: required(env, 'OBJECT_STORAGE_SECRET_KEY'),
    forcePathStyle: booleanValue(env.OBJECT_STORAGE_FORCE_PATH_STYLE),
  };
}
