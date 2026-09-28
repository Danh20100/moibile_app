import { Module } from '@nestjs/common';

import { createDatabaseClient } from './database.client';
import { loadDatabaseConfig } from './database.config';
import { DATABASE_CLIENT } from './database.tokens';

@Module({
  providers: [
    {
      provide: DATABASE_CLIENT,
      useFactory: () => createDatabaseClient(loadDatabaseConfig(process.env)),
    },
  ],
  exports: [DATABASE_CLIENT],
})
export class DatabaseModule {}
