import type { Kysely, Transaction } from 'kysely';

import type { CreateOrganizationInput, OrganizationRecord, OrganizationRepository } from '../../../persistence/ports/organization.repository';
import { mapPostgresError } from '../postgres-error.mapper';
import type { Database } from '../schema.types';

export class PostgresOrganizationRepository implements OrganizationRepository {
  constructor(private readonly executor: Kysely<Database> | Transaction<Database>) {}

  async createOrganization(input: CreateOrganizationInput): Promise<void> {
    try {
      await this.executor.insertInto('organizations').values({
        organization_id: input.organizationId, primary_owner_user_id: input.primaryOwnerUserId, name: input.name,
      }).execute();
    } catch (error) { throw mapPostgresError(error); }
  }

  async findOrganization(organizationId: string): Promise<OrganizationRecord | undefined> {
    try {
      const row = await this.executor.selectFrom('organizations')
        .select(['organization_id', 'primary_owner_user_id', 'name'])
        .where('organization_id', '=', organizationId).executeTakeFirst();
      return row ? { organizationId: row.organization_id, primaryOwnerUserId: row.primary_owner_user_id, name: row.name } : undefined;
    } catch (error) { throw mapPostgresError(error); }
  }

  async updateOrganization(record: OrganizationRecord): Promise<void> {
    try {
      await this.executor.updateTable('organizations').set({
        primary_owner_user_id: record.primaryOwnerUserId, name: record.name,
      }).where('organization_id', '=', record.organizationId).execute();
    } catch (error) { throw mapPostgresError(error); }
  }

  async lockOrganization(organizationId: string): Promise<void> {
    try {
      await this.executor.selectFrom('organizations').select('organization_id')
        .where('organization_id', '=', organizationId).forUpdate().executeTakeFirst();
    } catch (error) { throw mapPostgresError(error); }
  }
}
