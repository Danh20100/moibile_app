import { loadFixture } from './fixture-loader';
import type { OrganizationRecord } from '../../src/persistence/ports/organization.repository';
import type { PropertyRecord, RoomRecord } from '../../src/persistence/ports/property.repository';
import type { ListingRecord } from '../../src/persistence/ports/listing.repository';
import type {
  TenancyRecord,
  TenancyParticipantRecord,
} from '../../src/persistence/ports/tenancy.repository';
import type { IncidentRecord } from '../../src/persistence/ports/incident.repository';

interface RentalPersistenceFixture {
  version: number;
  ids: {
    user: string;
    org: string;
    property: string;
    room: string;
    listing: string;
    tenancy: string;
  };
  organization: OrganizationRecord;
  property: PropertyRecord;
  room: RoomRecord;
  listing: ListingRecord;
  tenancy: TenancyRecord;
  participant: TenancyParticipantRecord;
  incident: IncidentRecord;
  incidentClosure: { status: string; closureReason: string; closedAt: string };
  checkout: { endReason: string; endedAt: string; invalidEndedAt: string };
  secondTenancyId: string;
  expected: {
    published: string;
    unpublished: string;
    occupied: string;
    vacant: string;
    inactive: string;
    maintenance: string;
    ending: string;
    ended: string;
    archived: string;
    singleCommit: number;
    singleRejection: number;
    activationGuard: string;
    publishGuard: string;
    transitionGuard: string;
    archiveGuard: string;
    archiveBlocker: string;
    timeOrderError: string;
  };
}
export const rentalPersistenceFixture = loadFixture<RentalPersistenceFixture>(
  'rental/persistence-regression',
);
