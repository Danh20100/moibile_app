import { Logger } from '@nestjs/common';
import type { Kysely } from 'kysely';

import type {
  TransactionContext,
  TransactionManager,
} from '../../persistence/ports/transaction-manager';
import type { RepositorySetFactory } from './repositories/repository-set';
import type { Database } from './schema.types';

interface AfterCommitEffect {
  effect: () => Promise<void> | void;
  onError?: (error: unknown) => void;
}

export class PostgresTransactionManager implements TransactionManager {
  constructor(
    private readonly database: Kysely<Database>,
    private readonly repositorySetFactory: RepositorySetFactory,
    private readonly logger: Pick<Logger, 'error'> = new Logger(
      PostgresTransactionManager.name,
    ),
  ) {}

  async run<T>(
    work: (context: TransactionContext) => Promise<T>,
  ): Promise<T> {
    const effects: AfterCommitEffect[] = [];
    const result = await this.database.transaction().execute((executor) =>
      work({
        repositories: this.repositorySetFactory(executor),
        afterCommit: (effect, onError) => effects.push({ effect, onError }),
      }),
    );

    for (const { effect, onError } of effects) {
      try {
        await effect();
      } catch (error) {
        if (onError) {
          try {
            onError(error);
          } catch (handlerError) {
            this.logger.error('Transaction after-commit error handler failed', handlerError);
          }
        } else {
          this.logger.error('Transaction after-commit effect failed', error);
        }
      }
    }
    return result;
  }
}
