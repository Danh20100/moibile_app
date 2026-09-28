import type { Transaction } from 'kysely';

import type { PersistenceRepositories } from '../../../persistence/ports/transaction-manager';
import type { Database } from '../schema.types';

export interface RepositorySetFactory {
  (executor: Transaction<Database>): PersistenceRepositories;
}
