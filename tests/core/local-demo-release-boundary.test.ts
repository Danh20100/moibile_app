import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { it } from 'node:test';
import { ServiceUnavailableException } from '@nestjs/common';
import { LocalDemoAuthService } from '../../src/modules/identity-access/services/local-demo-auth.service';

it('refuses local-demo login in production even when accidentally enabled', async () => {
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    TROOI_LOCAL_DEMO_AUTH: process.env.TROOI_LOCAL_DEMO_AUTH,
    TROOI_DATABASE_MODE: process.env.TROOI_DATABASE_MODE,
  };
  try {
    process.env.NODE_ENV = 'production';
    process.env.TROOI_LOCAL_DEMO_AUTH = 'true';
    process.env.TROOI_DATABASE_MODE = 'compose-postgres';
    const service = new LocalDemoAuthService({} as never, {} as never);
    await assert.rejects(() => service.login('sample@example.com', 'notarealpassword'), ServiceUnavailableException);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

it('never silently classifies an existing local-demo session as a Google principal', () => {
  const resolver = readFileSync('src/modules/identity-access/services/google-principal-resolver.ts', 'utf8');
  assert.match(resolver, /to_regclass\('public\.local_dev_accounts'\)/);
  assert.match(resolver, /if \(isLocalDev && \(process\.env\.NODE_ENV === 'production'/);
  assert.match(resolver, /throw new UnauthorizedException\('Local demo session is disabled'\)/);
});

it('does not expose local-demo authentication in the Backend API', () => {
  const controller = readFileSync('src/modules/identity-access/controllers/identity-access.controller.ts', 'utf8');
  const module = readFileSync('src/modules/identity-access/identity-access.module.ts', 'utf8');
  const openapi = JSON.parse(readFileSync('docs/api/openapi.json', 'utf8')) as { paths: Record<string, unknown> };
  assert.doesNotMatch(controller, /Post\(['"]auth\/local-demo['"]\)/);
  assert.doesNotMatch(controller, /LocalDemoAuthService/);
  assert.doesNotMatch(module, /LocalDemoAuthService/);
  assert.equal(openapi.paths['/identity-access/auth/local-demo'], undefined);
});
