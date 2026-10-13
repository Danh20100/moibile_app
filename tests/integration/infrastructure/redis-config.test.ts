import assert from 'node:assert/strict';
import test from 'node:test';

import {
  loadRedisConfig,
  RedisConfigurationError,
} from '../../../src/infrastructure/cache/redis.config';

test('Redis remains disabled when URL is missing, blank, or whitespace', () => {
  for (const url of [undefined, '', '  ']) {
    assert.deepEqual(loadRedisConfig({ REDIS_URL: url }), { enabled: false });
  }
});

test('Redis enabled configuration is explicitly scoped and validated', () => {
  assert.deepEqual(
    loadRedisConfig({
      REDIS_URL: 'rediss://cache.example.test:6380/0',
      CACHE_ENVIRONMENT: 'staging',
      REDIS_CONNECT_TIMEOUT_MS: '1500',
    }),
    {
      enabled: true,
      url: 'rediss://cache.example.test:6380/0',
      environment: 'staging',
      connectTimeoutMs: 1500,
    },
  );
  for (const invalid of ['not-a-url', 'https://example.test', 'redis://']) {
    assert.throws(
      () => loadRedisConfig({ REDIS_URL: invalid, CACHE_ENVIRONMENT: 'dev' }),
      RedisConfigurationError,
    );
  }
  for (const invalid of [undefined, '', 'PROD', 'dev/test', 'local_dev']) {
    assert.throws(
      () => loadRedisConfig({ REDIS_URL: 'redis://localhost:6379', CACHE_ENVIRONMENT: invalid }),
      RedisConfigurationError,
    );
  }
  for (const invalid of ['0', '-1', '1.5', 'NaN', '9007199254740992']) {
    assert.throws(
      () => loadRedisConfig({
        REDIS_URL: 'redis://localhost:6379',
        CACHE_ENVIRONMENT: 'test',
        REDIS_CONNECT_TIMEOUT_MS: invalid,
      }),
      RedisConfigurationError,
    );
  }
});
