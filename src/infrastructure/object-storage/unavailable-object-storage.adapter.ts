import type { ObjectStoragePort } from '../../persistence/ports/object-storage.port';

export class ObjectStorageUnavailableError extends Error {
  constructor() {
    super('Object storage adapter is not available: upload/download is not implemented');
    this.name = ObjectStorageUnavailableError.name;
  }
}

/** Fail closed until an authenticated, tested S3-compatible adapter is added. */
export class UnavailableObjectStorageAdapter implements ObjectStoragePort {
  async putObject(_input: {
    key: string;
    bytes: Uint8Array;
    contentType: string;
  }): Promise<void> {
    throw new ObjectStorageUnavailableError();
  }

  async getObject(_key: string): Promise<{
    bytes: Uint8Array;
    contentType: string;
  } | null> {
    throw new ObjectStorageUnavailableError();
  }
}
