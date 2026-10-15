/**
 * Ephemeral performance-only cache. Every value must be reconstructable from
 * PostgreSQL; callers must not use this port for authorization or settlement.
 */
export interface CachePort {
  getJson<T>(key: string): Promise<T | null>;
  setJson<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<void>;
}

export const CACHE_PORT = Symbol('CACHE_PORT');
