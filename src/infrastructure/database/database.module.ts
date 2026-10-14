import { Module } from '@nestjs/common';
import type { Kysely } from 'kysely';

import { TRANSACTION_MANAGER } from '../../persistence/ports/transaction-manager';
import { createDatabaseClient } from './database.client';
import { loadDatabaseConfig } from './database.config';
import { DATABASE_CLIENT } from './database.tokens';
import { DatabaseLifecycleService } from './database-lifecycle.service';
import { PostgresTransactionManager } from './postgres-transaction-manager';
import { createRepositorySet } from './repositories/repository-set';
import { RentalTransactionCoordinator } from '../../persistence/guards/rental-transaction-coordinator';
import type { Database } from './schema.types';

@Module({
  providers: [
    DatabaseLifecycleService,
    {
      provide: DATABASE_CLIENT,
      useFactory: () => createDatabaseClient(loadDatabaseConfig(process.env)),
    },
    {
      provide: TRANSACTION_MANAGER,
      inject: [DATABASE_CLIENT],
      useFactory: (database: Kysely<Database>) => new PostgresTransactionManager(database, createRepositorySet),
    },
    {
      provide: RentalTransactionCoordinator,
      inject: [TRANSACTION_MANAGER],
      useFactory: (transactions: import('../../persistence/ports/transaction-manager').TransactionManager) => new RentalTransactionCoordinator(transactions),
    },
  ],
  exports: [DATABASE_CLIENT, TRANSACTION_MANAGER, RentalTransactionCoordinator],
})
export class DatabaseModule {}
