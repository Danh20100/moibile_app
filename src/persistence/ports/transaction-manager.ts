import type { IdentityFoundationRepository } from './identity-foundation.repository';
import type { FinanceRepository } from './finance.repository';
import type { IdentityRepository } from './identity.repository';
import type { IncidentRepository } from './incident.repository';
import type { ListingRepository } from './listing.repository';
import type { NotificationRepository } from './notification.repository';
import type { OrganizationRepository } from './organization.repository';
import type { PropertyRepository } from './property.repository';
import type { TenancyRepository } from './tenancy.repository';
import type { TrustRepository } from './trust.repository';

export interface PersistenceRepositories {
  identity: IdentityRepository;
  identityFoundation: IdentityFoundationRepository;
  organization: OrganizationRepository;
  property: PropertyRepository;
  listing: ListingRepository;
  tenancy: TenancyRepository;
  finance: FinanceRepository;
  incident: IncidentRepository;
  trust: TrustRepository;
  notification: NotificationRepository;
}

export interface TransactionContext {
  repositories: PersistenceRepositories;
  afterCommit(
    effect: () => Promise<void> | void,
    onError?: (error: unknown) => void,
  ): void;
}

export interface TransactionManager {
  run<T>(work: (context: TransactionContext) => Promise<T>): Promise<T>;
}

export const TRANSACTION_MANAGER = Symbol('TRANSACTION_MANAGER');
