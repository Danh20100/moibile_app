import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { ObjectStorageModule } from '../../infrastructure/object-storage/object-storage.module';
import { MessagingController } from './messaging.controller';
import { MessagingRepository } from './messaging.repository';
import { MessagingService } from './messaging.service';

@Module({
  imports: [DatabaseModule, ObjectStorageModule],
  controllers: [MessagingController],
  providers: [
    MessagingRepository,
    MessagingService,
  ],
})
export class MessagingModule {}
