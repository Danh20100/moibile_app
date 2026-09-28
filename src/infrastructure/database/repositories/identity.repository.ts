import type { Kysely, Transaction } from 'kysely';

import type { IdentityRepository } from '../../../persistence/ports/identity.repository';
import { mapPostgresError } from '../postgres-error.mapper';
import type { Database } from '../schema.types';

export class PostgresIdentityRepository implements IdentityRepository {
  constructor(private readonly executor: Kysely<Database> | Transaction<Database>) {}

  async insertUser(userId: string): Promise<void> {
    try { await this.executor.insertInto('users').values({ user_id: userId }).execute(); }
    catch (error) { throw mapPostgresError(error); }
  }

  async userExists(userId: string): Promise<boolean> {
    try {
      return (await this.executor.selectFrom('users').select('user_id').where('user_id', '=', userId).executeTakeFirst()) !== undefined;
    } catch (error) { throw mapPostgresError(error); }
  }
}
