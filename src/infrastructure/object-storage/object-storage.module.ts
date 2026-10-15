import { Module } from '@nestjs/common';
import { loadObjectStorageConfig } from './object-storage.config';
import { createObjectStorageAdapter } from './private-s3-object-storage.adapter';
import { OBJECT_STORAGE_PORT } from '../../persistence/ports/object-storage.port';

@Module({
  providers: [{ provide: OBJECT_STORAGE_PORT, useFactory: () => createObjectStorageAdapter(loadObjectStorageConfig(process.env)) }],
  exports: [OBJECT_STORAGE_PORT],
})
export class ObjectStorageModule {}
