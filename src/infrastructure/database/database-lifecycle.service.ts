import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import type { Kysely } from 'kysely';
import { DATABASE_CLIENT } from './database.tokens';
import type { Database } from './schema.types';

@Injectable()
export class DatabaseLifecycleService implements OnApplicationShutdown {
  constructor(@Inject(DATABASE_CLIENT) private readonly database:Kysely<Database>){}
  async onApplicationShutdown():Promise<void>{await this.database.destroy();}
}
