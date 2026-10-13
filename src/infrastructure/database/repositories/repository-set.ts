import { PostgresIdentityFoundationRepository } from './identity-foundation.repository';
import type { Transaction } from 'kysely';

import type { PersistenceRepositories } from '../../../persistence/ports/transaction-manager';
import type { Database } from '../schema.types';
import { PostgresFinanceRepository } from './finance.repository';
import { PostgresIdentityRepository } from './identity.repository';
import { PostgresIncidentRepository } from './incident.repository';
import { PostgresListingRepository } from './listing.repository';
import { PostgresNotificationRepository } from './notification.repository';
import { PostgresOrganizationRepository } from './organization.repository';
import { PostgresPropertyRepository } from './property.repository';
import { PostgresTenancyRepository } from './tenancy.repository';
import { PostgresTrustRepository } from './trust.repository';

export interface RepositorySetFactory {
  (executor: Transaction<Database>): PersistenceRepositories;
}

export const createRepositorySet: RepositorySetFactory = (executor) => ({
  identityFoundation: new PostgresIdentityFoundationRepository(executor),
  identity: new PostgresIdentityRepository(executor), organization: new PostgresOrganizationRepository(executor),
  property: new PostgresPropertyRepository(executor), listing: new PostgresListingRepository(executor),
  tenancy: new PostgresTenancyRepository(executor), finance: new PostgresFinanceRepository(executor),
  incident: new PostgresIncidentRepository(executor), trust: new PostgresTrustRepository(executor),
  notification: new PostgresNotificationRepository(executor),
});
