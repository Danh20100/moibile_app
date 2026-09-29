import assert from 'node:assert/strict';
import test from 'node:test';

import { createDatabaseClient } from '../../../src/infrastructure/database/database.client';
import { PostgresTransactionManager } from '../../../src/infrastructure/database/postgres-transaction-manager';
import { createRepositorySet } from '../../../src/infrastructure/database/repositories/repository-set';
import { OrganizationService } from '../../../src/modules/organization/services/organization.service';
import { PropertyService } from '../../../src/modules/property/services/property.service';
import { RoomService } from '../../../src/modules/room/services/room.service';
import { ListingService } from '../../../src/modules/listing/services/listing.service';
import { InquiryService } from '../../../src/modules/listing/services/inquiry.service';
import { TenancyService } from '../../../src/modules/tenancy/services/tenancy.service';
import { TenancyParticipantService } from '../../../src/modules/tenancy/services/tenancy-participant.service';
import { TenancyTermsService } from '../../../src/modules/tenancy/services/tenancy-terms.service';
import { TermsAcknowledgementService } from '../../../src/modules/tenancy/services/terms-acknowledgement.service';
import { TenancyNoticeService } from '../../../src/modules/tenancy/services/tenancy-notice.service';
import { runMigrations } from '../../../scripts/database/migrate';
import { resetPublicSchema } from './support/postgres-test-harness';

function runtime(databaseUrl: string) {
  const database = createDatabaseClient({ url: databaseUrl, maxPoolSize: 4, connectionTimeoutMs: 5000 });
  const transactions = new PostgresTransactionManager(database, createRepositorySet);
  const organizations = new OrganizationService(transactions);
  const properties = new PropertyService(organizations, transactions);
  const rooms = new RoomService(properties, transactions);
  const listings = new ListingService(transactions);
  const inquiries = new InquiryService(listings, transactions);
  const tenancies = new TenancyService(transactions);
  const participants = new TenancyParticipantService(tenancies, transactions);
  const terms = new TenancyTermsService(tenancies, transactions);
  const acknowledgements = new TermsAcknowledgementService(terms, participants, transactions);
  const notices = new TenancyNoticeService(tenancies, transactions);
  return { database, transactions, organizations, properties, rooms, listings, inquiries, tenancies, participants, terms, acknowledgements, notices };
}

test('core application state remains readable after database client restart', async () => {
  const databaseUrl = process.env.TEST_DATABASE_URL;
  assert.ok(databaseUrl, 'TEST_DATABASE_URL is required');
  await resetPublicSchema(databaseUrl);
  await runMigrations('up', databaseUrl);

  const first = runtime(databaseUrl);
  const ownerId = '10000000-0000-4000-8000-000000000099';
  await first.transactions.run(({ repositories }) => repositories.identity.ensureUser(ownerId));
  const organization = await first.organizations.create({ name: 'Restart Workspace', primaryOwnerUserId: ownerId });
  const property = await first.properties.create({ organizationId: organization.id, name: 'Restart Property', operationalAddressText: 'Private address', operationalLocation: { longitude: 106.7, latitude: 10.7 }, publicLocationProjection: { longitude: 106.701, latitude: 10.701 } });
  const room = await first.rooms.create({ propertyId: property.id, nameOrLabel: 'A-01' });
  const listing = await first.listings.createDraft({ roomId: room.id, publicTitle: 'Restart Listing', publicDescription: 'Persisted public content', publicPriceProjection: '3500000.00', publicLocationProjection: { longitude: 106.701, latitude: 10.701 } });
  const inquiry = await first.inquiries.create({ listingId: listing.id, contactIntentOrMessage: 'Interested', status: 'NEW' });
  const tenancy = await first.tenancies.createDraft(room.id);
  const participant = await first.participants.add({ tenancyId: tenancy.id, userId: ownerId, role: 'PRIMARY', joinedAt: '2026-09-29T00:00:00.000Z' });
  const terms = await first.terms.createVersion({ tenancyId: tenancy.id, version: 1, rentAmount: '3500000.00', agreedDepositRequirement: '3500000.00', termStart: '2026-10-01', termEnd: '2027-09-30', billingDayOrDueDateRule: { day: 1 }, electricityArrangement: { mode: 'metered' }, waterArrangement: { mode: 'metered' }, minimalRentalConditions: { occupants: 1 }, effectiveFromCycleBoundary: '2026-10-01' });
  const acknowledgement = await first.acknowledgements.acknowledge({ tenancyTermsId: terms.id, tenancyParticipantId: participant.id, userId: ownerId, acknowledgedAt: '2026-09-29T00:01:00.000Z' });
  const notice = await first.notices.issue({ tenancyId: tenancy.id, noticeType: 'GENERAL', issuedByUserId: ownerId, contentOrNote: 'Persisted notice', issuedAt: '2026-09-29T00:02:00.000Z' });
  await first.database.destroy();

  const second = runtime(databaseUrl);
  try {
    assert.deepEqual(await second.organizations.findById(organization.id), organization);
    assert.deepEqual(await second.properties.findById(property.id), property);
    assert.deepEqual(await second.rooms.findById(room.id), room);
    assert.deepEqual(await second.listings.findById(listing.id), listing);
    assert.deepEqual(await second.inquiries.findById(inquiry.id), inquiry);
    assert.deepEqual(await second.tenancies.findById(tenancy.id), tenancy);
    assert.deepEqual(await second.participants.findById(participant.id), participant);
    assert.deepEqual(await second.terms.findById(terms.id), terms);
    assert.deepEqual(await second.acknowledgements.listByTermsId(terms.id), [acknowledgement]);
    assert.deepEqual(await second.notices.findById(notice.id), notice);
  } finally { await second.database.destroy(); }
});
