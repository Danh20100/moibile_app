import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { loadObjectStorageConfig } from '../../infrastructure/object-storage/object-storage.config';
import { createObjectStorageAdapter } from '../../infrastructure/object-storage/private-s3-object-storage.adapter';
import { OBJECT_STORAGE_PORT } from '../../persistence/ports/object-storage.port';
import { MessagingController } from './messaging.controller';
import { MessagingRepository } from './messaging.repository';
import { MessagingService } from './messaging.service';

@Module({
  imports: [DatabaseModule],
  controllers: [MessagingController],
  providers: [
    MessagingRepository,
    MessagingService,
    {
      provide: OBJECT_STORAGE_PORT,
      useFactory: () => createObjectStorageAdapter(loadObjectStorageConfig(process.env)),
    },
  ],
})
export class MessagingModule {}
