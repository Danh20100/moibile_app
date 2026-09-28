import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DatabaseConfigurationError,
  loadDatabaseConfig,
} from '../../../src/infrastructure/database/database.config';

test('loads the required URL and configured pool values exactly', () => {
  assert.deepEqual(
    loadDatabaseConfig({
      DATABASE_URL: 'postgresql://trooi:secret@localhost:5432/trooi_dev',
      DATABASE_POOL_MAX: '17',
      DATABASE_CONNECTION_TIMEOUT_MS: '7300',
    }),
    {
      url: 'postgresql://trooi:secret@localhost:5432/trooi_dev',
      maxPoolSize: 17,
      connectionTimeoutMs: 7300,
    },
  );
});

test('uses documented defaults for optional values', () => {
  assert.deepEqual(
    loadDatabaseConfig({ DATABASE_URL: 'postgres://localhost/trooi_dev' }),
    {
      url: 'postgres://localhost/trooi_dev',
      maxPoolSize: 10,
      connectionTimeoutMs: 5000,
    },
  );
});

test('rejects an absent, blank, or invalid database URL', () => {
  for (const databaseUrl of [undefined, '', '  ', 'https://localhost/database']) {
    assert.throws(
      () => loadDatabaseConfig({ DATABASE_URL: databaseUrl }),
      DatabaseConfigurationError,
    );
  }
});

test('rejects invalid pool and connection timeout values', () => {
  const invalidValues = ['0', '-1', '1.5', 'not-a-number', ''];
  for (const value of invalidValues) {
    assert.throws(
      () =>
        loadDatabaseConfig({
          DATABASE_URL: 'postgresql://localhost/trooi_dev',
          DATABASE_POOL_MAX: value,
        }),
      DatabaseConfigurationError,
    );
    assert.throws(
      () =>
        loadDatabaseConfig({
          DATABASE_URL: 'postgresql://localhost/trooi_dev',
          DATABASE_CONNECTION_TIMEOUT_MS: value,
        }),
      DatabaseConfigurationError,
    );
  }
});
