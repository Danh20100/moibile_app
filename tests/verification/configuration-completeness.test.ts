import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const runtime = require('../../scripts/config/verify-runtime.cjs') as {
  databaseUrlForCompose: (env: Record<string, string>) => string;
  isolatedDemoDatabaseUrl: (env: Record<string, string>) => string;
  validateFinanceRuntime: (env: Record<string, string>, verify: (env: unknown) => unknown) => void;
};
const source = (path: string) => readFileSync(path, 'utf8');
const matches = (text: string, re: RegExp) => [...text.matchAll(re)].map((x) => x[1]);
function walk(path: string): string[] {
  return readdirSync(path, { withFileTypes: true }).flatMap((d) => {
    const next = join(path, d.name);
    return d.isDirectory()
      ? ['node_modules', 'build', 'dist', 'fixtures'].includes(d.name)
        ? []
        : walk(next)
      : /\.(ts|js|cjs|mjs|kt|py|sh)$/.test(d.name) && !/\.(spec|test)\.ts$/.test(d.name)
        ? [next]
        : [];
  });
}

test('environment variables are documented in the minimal template or optional-environment guide', () => {
  const names = matches(source('.env.example'), /^([A-Z][A-Z0-9_]*)=/gm);
  const keySet = new Set(names);
  const documentedOptional = new Set(
    matches(source('docs/configuration/optional-environment.md'), /`([A-Z][A-Z0-9_]*)`/g),
  );
  assert.equal(names.length, keySet.size, 'Template contains duplicate keys');
  const references = new Set<string>();
  for (const root of ['src', 'scripts', 'database', 'app/src']) {
    for (const path of walk(root)) {
      const text = source(path);
      for (const pattern of [
        /\bprocess\.env\.([A-Z][A-Z0-9_]*)\b/g,
        /\bprocess\.env\[['"]([A-Z][A-Z0-9_]*)['"]\]/g,
        /\benv\.([A-Z][A-Z0-9_]*)\b/g,
        /\bSystem\.getenv\(['"]([A-Z][A-Z0-9_]*)['"]\)/g,
      ])
        matches(text, pattern).forEach((name) => references.add(name));
    }
  }
  const compose = source('docker-compose.yml');
  matches(compose, /\$\{([A-Z][A-Z0-9_]*)/g).forEach((key) => references.add(key));
  const gradle = source('app/build.gradle.kts');
  matches(gradle, /clientSetting\("[^"]+",\s*"([A-Z][A-Z0-9_]*)"/g).forEach((key) =>
    references.add(key),
  );
  matches(gradle, /clientSetting\("[^"]+",\s*"[A-Z][A-Z0-9_]+",\s*"([A-Z][A-Z0-9_]*)"/g).forEach(
    (key) => references.add(key),
  );
  assert.deepEqual(
    [...references].filter((name) => !keySet.has(name) && !documentedOptional.has(name)).sort(),
    [],
  );
});

test('Docker keeps local and production finance runtime separate and fails closed', () => {
  const yaml = source('docker-compose.yml');
  const dev = yaml.split('  backend:\n')[1]?.split('  # Full application backend')[0] ?? '';
  const finance = yaml.split('  finance-backend:\n')[1]?.split('  redis:\n')[0] ?? '';
  assert.ok(dev && finance, 'Both backends must exist');
  assert.match(dev, /SEPAY_ENABLED: "false"/);
  assert.doesNotMatch(dev, /SEPAY_SECRET_KEY|SEPAY_IPN_SECRET_KEY|SEPAY_HANDOFF_SIGNING_KEY/);
  assert.match(dev, /TROOI_DATABASE_MODE: compose-postgres/);
  assert.match(finance, /profiles: \[finance-production\]/);
  assert.match(finance, /TROOI_DATABASE_MODE: external-finance/);
  assert.match(finance, /DATABASE_URL: \$\{SEPAY_FINANCE_DATABASE_URL:-\}/);
  assert.match(yaml, /NODE_ENV: production/);
  assert.match(yaml, /\$\{TROOI_BACKEND_BIND:-127\.0\.0\.1\}:\$\{BACKEND_PORT:-3000\}:3000/);
  assert.match(yaml, /\$\{TROOI_BACKEND_BIND:-127\.0\.0\.1\}:\$\{SEPAY_BACKEND_PORT:-3101\}:3000/);
  assert.match(source('docker-entrypoint.sh'), /verify-runtime\.cjs finance/);
  assert.match(source('Dockerfile'), /COPY scripts\/config\/verify-runtime\.cjs/);
  for (const key of [
    'POSTGRES_PASSWORD',
    'MINIO_ROOT_PASSWORD',
    'MESSAGING_DB_PASSWORD',
    'MESSAGING_MINIO_PASSWORD',
    'TROOI_STANDALONE_DB_PASSWORD',
    'SEPAY_SECRET_KEY',
    'SEPAY_IPN_SECRET_KEY',
    'SEPAY_HANDOFF_SIGNING_KEY',
  ]) {
    const minimal = source('.env.example');
    const placeholder = new RegExp('^' + key + '=$', 'm');
    if (minimal.includes(key + '=')) assert.match(minimal, placeholder);
    else
      assert.ok(
        source('docs/configuration/optional-environment.md').includes('`' + key + '`'),
        `${key} must be documented as optional`,
      );
  }
});

test('Gradle documents all client properties but its template never shadows .env values', () => {
  const gradle = source('app/build.gradle.kts');
  const example = source('gradle.properties.example');
  for (const key of [
    'trooiApiBaseUrl',
    'trooiGoogleWebClientId',
    'trooiMapsApiKey',
    'trooiPaymentPublicOrigin',
    'trooiReleasePaymentPublicOrigin',
    'trooiDemoBackendEnabled',
    'trooiInstrumentationBuildType',
  ]) {
    assert.ok(gradle.includes(key));
    assert.ok(example.includes(key));
    assert.doesNotMatch(example, new RegExp('^' + key + '=', 'm'));
  }
  assert.doesNotMatch(
    gradle,
    /SEPAY_SECRET_KEY|SEPAY_IPN_SECRET_KEY|DATABASE_URL|POSTGRES_PASSWORD/,
  );
});

test('local PostgreSQL URL handles reserved password characters', () => {
  const password = 'a:b@c/#?%';
  const url = runtime.databaseUrlForCompose({
    POSTGRES_USER: 'trooi',
    POSTGRES_PASSWORD: password,
    POSTGRES_DB: 'trooi_dev',
  });
  const parsed = new URL(url);
  assert.equal(parsed.hostname, 'postgres');
  assert.equal(decodeURIComponent(parsed.password), password);
  assert.equal(parsed.pathname, '/trooi_dev');
  const shared = new URL(
    runtime.databaseUrlForCompose({
      POSTGRES_USER: 'trooi',
      POSTGRES_PASSWORD: password,
      POSTGRES_DB: 'tro-oi',
    }),
  );
  assert.equal(shared.pathname, '/tro-oi');
  assert.throws(() =>
    runtime.databaseUrlForCompose({
      POSTGRES_USER: 'trooi',
      POSTGRES_PASSWORD: '',
      POSTGRES_DB: 'trooi_dev',
    }),
  );
});

test('demo verification rejects a preset database outside isolated compose', () => {
  const compose = {
    POSTGRES_USER: 'trooi',
    POSTGRES_PASSWORD: 'synthetic-local',
    POSTGRES_DB: 'trooi_dev',
  };
  const composed = new URL(runtime.isolatedDemoDatabaseUrl(compose));
  assert.equal(composed.hostname, 'postgres');
  assert.equal(composed.pathname, '/trooi_dev');
  const preset = 'postgresql://trooi:synthetic-local@postgres:5432/trooi_dev';
  assert.equal(
    runtime.isolatedDemoDatabaseUrl({
      ...compose,
      DATABASE_URL: preset,
      POSTGRES_DB: 'trooi_finance',
    }),
    preset,
  );
  for (const url of [
    'postgresql://trooi:synthetic-local@postgres:5432/trooi_finance',
    'postgresql://trooi:synthetic-local@postgres:5432/trooi_test',
    'postgresql://trooi:synthetic-local@localhost:5432/trooi_dev',
    'postgresql://trooi:synthetic-local@database.example:5432/trooi_finance',
    'not a url',
  ]) {
    assert.throws(
      () => runtime.isolatedDemoDatabaseUrl({ DATABASE_URL: url }),
      (error: Error) =>
        error.message === 'Refusing demo verification outside the isolated compose database' &&
        !error.message.includes('synthetic-local'),
    );
  }
});

test('finance runtime rejects disabled gateway, nonproduction mode and wrong DB', () => {
  const valid = {
    NODE_ENV: 'production',
    TROOI_DATABASE_MODE: 'external-finance',
    SEPAY_ENABLED: 'true',
    SEPAY_ENVIRONMENT: 'production',
    DATABASE_URL: 'postgresql://merchant:synthetic-secret@database.example:5432/trooi_finance',
    SEPAY_FINANCE_DATABASE: 'trooi_finance',
  };
  assert.doesNotThrow(() => runtime.validateFinanceRuntime(valid, () => true));
  for (const bad of [
    { ...valid, NODE_ENV: 'development' },
    { ...valid, SEPAY_ENABLED: 'false' },
    { ...valid, DATABASE_URL: 'postgresql://merchant:secret@database.example:5432/other' },
    {
      ...valid,
      DATABASE_URL: 'postgresql://merchant:secret@database.example:5432/trooi_dev',
      SEPAY_FINANCE_DATABASE: 'trooi_dev',
    },
    { ...valid, DATABASE_URL: 'postgresql://database.example:5432/trooi_finance' },
    { ...valid, SEPAY_FINANCE_DATABASE: '' },
  ])
    assert.throws(() => runtime.validateFinanceRuntime(bad, () => true));
  assert.throws(() => runtime.validateFinanceRuntime(valid, () => null));
});

test('configuration preflight checks only enabled profiles and never invents provider credentials', () => {
  const { validateLocalConfig } = require('../../scripts/config/check-local.cjs') as {
    validateLocalConfig: (env: Record<string, string>, profiles?: string[]) => void;
  };
  const local = {
    POSTGRES_USER: 'trooi',
    POSTGRES_PASSWORD: 'synthetic-local',
    POSTGRES_DB: 'trooi_dev',
    POSTGRES_TEST_DB: 'trooi_test',
    MINIO_ROOT_PASSWORD: 'synthetic-minio',
    TROOI_COMPREFACE_DB_PASSWORD: 'synthetic-compreface',
  };
  assert.doesNotThrow(() => validateLocalConfig(local));
  assert.throws(() => validateLocalConfig({ ...local, POSTGRES_PASSWORD: '' }));
  assert.throws(() => validateLocalConfig({ ...local, MINIO_ROOT_PASSWORD: '' }));
  assert.throws(() => validateLocalConfig({ ...local, TROOI_COMPREFACE_DB_PASSWORD: '' }));
  assert.throws(() => validateLocalConfig({ ...local, COMPREFACE_ENABLED: 'true' }));
  assert.doesNotThrow(() => validateLocalConfig({
    ...local, COMPREFACE_ENABLED: 'true',
    COMPREFACE_ORIGIN: 'http://compreface-fe',
    COMPREFACE_API_KEY: 'synthetic-only',
  }));
  assert.doesNotThrow(() => validateLocalConfig(local, ['local-infra']));
  assert.throws(() => validateLocalConfig(local, ['messaging-test']));
  assert.throws(() => validateLocalConfig(local, ['sepay-isolated']));
  assert.throws(() => validateLocalConfig(local, ['finance-production']));
  assert.throws(() => validateLocalConfig(local, ['unknown-profile']));
});
