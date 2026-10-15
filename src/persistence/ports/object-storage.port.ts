/**
 * Private object bytes only. The caller remains responsible for authorization,
 * media policy, and durable PostgreSQL metadata. No public URL is implied.
 *
 * Implementations must not expose a successful write until storage confirms it.
 */
export interface ObjectStoragePort {
  deleteObject?(key: string): Promise<void>;
  putObject(input: {
    key: string;
    bytes: Uint8Array;
    contentType: string;
  }): Promise<void>;

  getObject(key: string): Promise<{
    bytes: Uint8Array;
    contentType: string;
  } | null>;
}

export const OBJECT_STORAGE_PORT = Symbol('OBJECT_STORAGE_PORT');
