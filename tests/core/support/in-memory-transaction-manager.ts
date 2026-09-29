import type { OrganizationRecord } from '../../../src/persistence/ports/organization.repository';
import type { PropertyRecord, RoomRecord } from '../../../src/persistence/ports/property.repository';
import type { TransactionManager } from '../../../src/persistence/ports/transaction-manager';
import type { InquiryRecord, ListingRecord, ListingStatusEventRecord } from '../../../src/persistence/ports/listing.repository';
import type { TenancyNoticeRecord, TenancyParticipantRecord, TenancyRecord, TenancyTermsRecord, TermsAcknowledgementRecord } from '../../../src/persistence/ports/tenancy.repository';

export function createCoreTestTransactionManager(): TransactionManager {
  const users = new Set<string>();
  const organizations = new Map<string, OrganizationRecord>();
  const properties = new Map<string, PropertyRecord>();
  const rooms = new Map<string, RoomRecord>();
  const listings = new Map<string, ListingRecord>();
  const listingEvents: ListingStatusEventRecord[] = [];
  const inquiries = new Map<string, InquiryRecord>();
  const tenancies = new Map<string, TenancyRecord>();
  const participants = new Map<string, TenancyParticipantRecord>();
  const terms = new Map<string, TenancyTermsRecord>();
  const acknowledgements = new Map<string, TermsAcknowledgementRecord>();
  const notices = new Map<string, TenancyNoticeRecord>();
  const repositories = {
    identity: { ensureUser: async (id: string) => { users.add(id); }, userExists: async (id: string) => users.has(id) },
    organization: {
      createOrganization: async (value: OrganizationRecord) => { organizations.set(value.organizationId, structuredClone(value)); },
      findOrganization: async (id: string) => structuredClone(organizations.get(id)),
      findOrganizations: async () => Array.from(organizations.values()).map((value) => structuredClone(value)),
      updateOrganization: async (value: OrganizationRecord) => { organizations.set(value.organizationId, structuredClone(value)); },
      lockOrganization: async () => undefined,
    },
    property: {
      createProperty: async (value: PropertyRecord) => { properties.set(value.propertyId, structuredClone(value)); },
      findProperty: async (id: string) => structuredClone(properties.get(id)),
      findPropertiesByOrganization: async (id?: string) => Array.from(properties.values()).filter((value) => !id || value.organizationId === id).map((value) => structuredClone(value)),
      updateProperty: async (value: PropertyRecord) => { properties.set(value.propertyId, structuredClone(value)); },
      createRoom: async (value: RoomRecord) => { rooms.set(value.roomId, structuredClone(value)); },
      findRoom: async (id: string) => structuredClone(rooms.get(id)),
      findRoomsByProperty: async (id: string) => Array.from(rooms.values()).filter((value) => value.propertyId === id).map((value) => structuredClone(value)),
      updateRoom: async (value: RoomRecord) => { rooms.set(value.roomId, structuredClone(value)); },
      lockProperty: async () => undefined,
      lockRoom: async () => undefined,
    },
    listing: {
      createListing: async (value: ListingRecord) => { listings.set(value.listingId, structuredClone(value)); },
      findListing: async (id: string) => structuredClone(listings.get(id)),
      findCurrentListingByRoom: async (roomId: string) => structuredClone(Array.from(listings.values()).find((value) => value.roomId === roomId && value.status !== 'ARCHIVED')),
      findPublishedListings: async () => Array.from(listings.values()).filter((value) => value.status === 'PUBLISHED').map((value) => structuredClone(value)),
      updateListing: async (value: ListingRecord) => { listings.set(value.listingId, structuredClone(value)); },
      insertStatusEvent: async (value: ListingStatusEventRecord) => { listingEvents.push(structuredClone(value)); },
      findStatusEvents: async (id: string) => listingEvents.filter((value) => value.listingId === id).map((value) => structuredClone(value)),
      createInquiry: async (value: InquiryRecord) => { inquiries.set(value.inquiryId, structuredClone(value)); },
      findInquiry: async (id: string) => structuredClone(inquiries.get(id)),
      findInquiriesByListing: async (id: string) => Array.from(inquiries.values()).filter((value) => value.listingId === id).map((value) => structuredClone(value)),
    },
    tenancy: {
      createTenancy: async (value: TenancyRecord) => { tenancies.set(value.tenancyId, structuredClone(value)); },
      findTenancy: async (id: string) => structuredClone(tenancies.get(id)),
      findTenanciesByRoom: async (roomId?: string) => Array.from(tenancies.values()).filter((value) => !roomId || value.roomId === roomId).map((value) => structuredClone(value)),
      findNonterminalByRoom: async (roomId: string) => Array.from(tenancies.values()).filter((value) => value.roomId === roomId && ['DRAFT', 'ACTIVE', 'ENDING'].includes(value.status)).map((value) => structuredClone(value)),
      updateTenancy: async (value: TenancyRecord) => { tenancies.set(value.tenancyId, structuredClone(value)); },
      lockTenancy: async () => undefined,
      insertParticipant: async (value: TenancyParticipantRecord) => { participants.set(value.tenancyParticipantId, structuredClone(value)); },
      findParticipant: async (id: string) => structuredClone(participants.get(id)),
      findParticipantsByUser: async (userId: string) => Array.from(participants.values()).filter((value) => value.userId === userId).map((value) => structuredClone(value)),
      findParticipantsByTenancy: async (tenancyId: string) => Array.from(participants.values()).filter((value) => value.tenancyId === tenancyId).map((value) => structuredClone(value)),
      findActivePrimary: async (tenancyId: string) => structuredClone(Array.from(participants.values()).find((value) => value.tenancyId === tenancyId && value.role === 'PRIMARY' && !value.leftAt)),
      updateParticipant: async (value: TenancyParticipantRecord) => { participants.set(value.tenancyParticipantId, structuredClone(value)); },
      insertTerms: async (value: TenancyTermsRecord) => { terms.set(value.tenancyTermsId, structuredClone(value)); },
      findTermsVersion: async (tenancyId: string, version: number) => structuredClone(Array.from(terms.values()).find((value) => value.tenancyId === tenancyId && value.version === version)),
      findTermsById: async (id: string) => structuredClone(terms.get(id)),
      findTermsByTenancy: async (tenancyId: string) => Array.from(terms.values()).filter((value) => value.tenancyId === tenancyId).sort((a, b) => a.version - b.version).map((value) => structuredClone(value)),
      insertAcknowledgement: async (value: TermsAcknowledgementRecord) => { acknowledgements.set(value.termsAcknowledgementId, structuredClone(value)); },
      findAcknowledgementsByTerms: async (termsId: string) => Array.from(acknowledgements.values()).filter((value) => value.tenancyTermsId === termsId).map((value) => structuredClone(value)),
      insertNotice: async (value: TenancyNoticeRecord) => { notices.set(value.tenancyNoticeId, structuredClone(value)); },
      findNotice: async (id: string) => structuredClone(notices.get(id)),
      findNoticesByTenancy: async (tenancyId: string) => Array.from(notices.values()).filter((value) => value.tenancyId === tenancyId).map((value) => structuredClone(value)),
      updateNotice: async (value: TenancyNoticeRecord) => { notices.set(value.tenancyNoticeId, structuredClone(value)); },
    },
  };
  return { run: async (work) => work({ repositories: repositories as never, afterCommit: () => undefined }) };
}
