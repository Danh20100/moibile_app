import type { CachePort } from '../../persistence/ports/cache.port';

/**
 * Safe fallback: all reads miss. Never indicates persistence or cache warmth.
 */
export class NoopCacheAdapter implements CachePort {
  async getJson<T>(_key: string): Promise<T | null> {
    return null;
  }

  async setJson<T>(_key: string, _value: T, _ttlSeconds: number): Promise<void> {
    // Explicitly no-op: source of truth is always PostgreSQL.
  }

  async delete(_key: string): Promise<void> {
    // Explicitly no-op.
  }
}
