import assert from 'node:assert/strict';
import test from 'node:test';

import { AuditTrustService } from '../../src/modules/audit-trust/services/audit-trust.service';
import { BillingService } from '../../src/modules/billing/services/billing.service';
import { IncidentService } from '../../src/modules/incident/services/incident.service';
import { InquiryService } from '../../src/modules/listing/services/inquiry.service';
import { ListingService } from '../../src/modules/listing/services/listing.service';
import { OrganizationService } from '../../src/modules/organization/services/organization.service';
import { PropertyService } from '../../src/modules/property/services/property.service';
import { RoomService } from '../../src/modules/room/services/room.service';
import { TenancyNoticeService } from '../../src/modules/tenancy/services/tenancy-notice.service';
import { TenancyService } from '../../src/modules/tenancy/services/tenancy.service';
import { createCoreTestTransactionManager } from './support/in-memory-transaction-manager';

const operatorUserId = '10000000-0000-4000-8000-000000000001';
const tenantUserId = '10000000-0000-4000-8000-000000000002';
const orgId = '20000000-0000-4000-8000-000000000001';
const propertyId = '30000000-0000-4000-8000-000000000001';
const roomId = '40000000-0000-4000-8000-000000000001';
const listingId = '50000000-0000-4000-8000-000000000001';
const tenancyId = '60000000-0000-4000-8000-000000000001';
const participantId = '70000000-0000-4000-8000-000000000001';
const termsId = 'terms-cross';

type TestTransactions = ReturnType<typeof createCoreTestTransactionManager>;

async function seedOrgAndProperty(transactions: TestTransactions): Promise<void> {
  await transactions.run(async ({ repositories }) => {
    await repositories.organization.createOrganization({
      organizationId: orgId,
      primaryOwnerUserId: operatorUserId,
      name: 'Test Org',
    });
    await repositories.property.createProperty({
      propertyId,
      organizationId: orgId,
      name: 'Test Property',
      lifecycleStatus: 'ACTIVE',
      operationalAddressText: 'Private Operational Address',
      operationalLocation: { longitude: 106.7, latitude: 10.8 },
      publicLocationProjection: { longitude: 106.71, latitude: 10.81 },
    });
  });
}

async function setupPublishedListing(transactions: TestTransactions) {
  await seedOrgAndProperty(transactions);
  await transactions.run(async ({ repositories }) => {
    await repositories.property.createRoom({
      roomId,
      propertyId,
      nameOrLabel: 'Room 101',
      operationalState: 'VACANT',
      recordLifecycle: 'ACTIVE',
    });
    await repositories.listing.createListing({
      listingId,
      roomId,
      status: 'PUBLISHED',
      publicTitle: 'Phong 101',
      publicDescription: 'Public description',
      publicPriceProjection: '3000000.00',
      publicLocationProjection: { longitude: 106.71, latitude: 10.81 },
    });
  });
  const nonterminal = await transactions.run(({ repositories }) =>
    repositories.tenancy.findNonterminalByRoom(roomId),
  );
  assert.equal(nonterminal.length, 0);
  return { operatorUserId, roomId, listingId };
}

async function setupOccupiedRental(transactions: TestTransactions) {
  await seedOrgAndProperty(transactions);
  await transactions.run(async ({ repositories }) => {
    await repositories.property.createRoom({
      roomId,
      propertyId,
      nameOrLabel: 'Room 101',
      operationalState: 'OCCUPIED',
      recordLifecycle: 'ACTIVE',
    });
    await repositories.listing.createListing({
      listingId,
      roomId,
      status: 'UNPUBLISHED',
      publicTitle: 'Phong 101',
      publicDescription: 'Public description',
      publicPriceProjection: '3000000.00',
      publicLocationProjection: { longitude: 106.71, latitude: 10.81 },
    });
    await repositories.tenancy.createTenancy({
      tenancyId,
      roomId,
      status: 'ACTIVE',
      startedAt: '2026-01-01T00:00:00.000Z',
      endedAt: null,
      endReason: null,
    });
    await repositories.tenancy.insertParticipant({
      tenancyParticipantId: participantId,
      tenancyId,
      userId: tenantUserId,
      role: 'PRIMARY',
      joinedAt: '2026-01-01T00:00:00.000Z',
      leftAt: null,
    });
    await repositories.tenancy.insertTerms({
      tenancyTermsId: termsId,
      tenancyId,
      version: 1,
      rentAmount: '3000000.00',
      agreedDepositRequirement: '3000000.00',
      termStart: '2026-01-01',
      termEnd: '2027-01-01',
      billingDayOrDueDateRule: {},
      electricityArrangement: {},
      waterArrangement: {},
      minimalRentalConditions: {},
      effectiveFromCycleBoundary: '2026-01-01',
    });
  });
  const listing = await transactions.run(({ repositories }) =>
    repositories.listing.findListing(listingId),
  );
  assert.notEqual(listing?.status, 'PUBLISHED');
  return { operatorUserId, tenantUserId, roomId, listingId, tenancyId, termsId };
}

test('CX-01: Searcher Inquiry creates notification for Listing operator without side effects', async () => {
  const transactions = createCoreTestTransactionManager();
  const { operatorUserId: ownerId, listingId: publishedId, roomId: vacantRoomId } =
    await setupPublishedListing(transactions);

  const listings = new ListingService(transactions);
  const inquiries = new InquiryService(listings, transactions);

  const searcherUserId = 'searcher-user-id';
  const inquiry = await inquiries.create({
    listingId: publishedId,
    senderUserId: searcherUserId,
    contactIntentOrMessage: 'Interested in this room',
    status: 'new',
  });

  const notifs = await transactions.run(({ repositories }) =>
    repositories.notification.findNotificationsByRecipient(ownerId),
  );
  assert.equal(notifs.length, 1);
  assert.equal(notifs[0]?.category, 'NEW_INQUIRY');
  assert.equal(notifs[0]?.messageOrPayloadReference, `inquiry:${inquiry.id}`);
  assert.equal(notifs[0]?.recipientUserId, ownerId);

  const currentListing = await listings.findById(publishedId);
  assert.equal(currentListing.status, 'published');

  const room = await transactions.run(({ repositories }) =>
    repositories.property.findRoom(vacantRoomId),
  );
  assert.equal(room?.operationalState, 'VACANT');
});

test('CX-02: Tenant Incident creation and status transitions emit notifications to correct actors', async () => {
  const transactions = createCoreTestTransactionManager();
  const { operatorUserId: ownerId, tenantUserId: reporterId, roomId: occupiedRoomId } =
    await setupOccupiedRental(transactions);

  const orgService = new OrganizationService(transactions);
  const propertyService = new PropertyService(orgService, transactions);
  const roomService = new RoomService(propertyService, transactions);
  const incidentService = new IncidentService(roomService, transactions);

  const incident = await incidentService.create({
    roomId: occupiedRoomId,
    reportedByUserId: reporterId,
    category: 'PLUMBING',
  });

  const operatorNotifs = await transactions.run(({ repositories }) =>
    repositories.notification.findNotificationsByRecipient(ownerId),
  );
  assert.equal(operatorNotifs.length, 1);
  assert.equal(operatorNotifs[0]?.category, 'NEW_INCIDENT');
  assert.equal(operatorNotifs[0]?.messageOrPayloadReference, `incident:${incident.id}`);

  await incidentService.updateStatus(incident.id, {
    status: 'ACKNOWLEDGED',
    actorUserId: ownerId,
    note: 'Will inspect tomorrow',
  });

  const tenantNotifs = await transactions.run(({ repositories }) =>
    repositories.notification.findNotificationsByRecipient(reporterId),
  );
  assert.equal(tenantNotifs.length, 1);
  assert.equal(tenantNotifs[0]?.category, 'INCIDENT_STATUS_CHANGED');
  assert.equal(tenantNotifs[0]?.messageOrPayloadReference, `incident:${incident.id}`);
});

test('CX-03: Billing cycle due and payment confirmed notify linked tenant', async () => {
  const transactions = createCoreTestTransactionManager();
  const { tenantUserId: linkedTenantId, tenancyId: activeTenancyId, termsId: governingTermsId } =
    await setupOccupiedRental(transactions);

  const tenancyService = new TenancyService(transactions);
  const billingService = new BillingService(tenancyService, transactions);

  const cycle = await billingService.createCycle({
    tenancyId: activeTenancyId,
    tenancyTermsId: governingTermsId,
    periodStart: '2026-10-01',
    periodEnd: '2026-10-31',
    charges: [{ type: 'RENT', amount: '3000000.00' }],
  });

  let tenantNotifs = await transactions.run(({ repositories }) =>
    repositories.notification.findNotificationsByRecipient(linkedTenantId),
  );
  assert.equal(tenantNotifs.length, 1);
  assert.equal(tenantNotifs[0]?.category, 'PAYMENT_DUE');
  assert.equal(tenantNotifs[0]?.messageOrPayloadReference, `billing_cycle:${cycle.id}`);

  const payment = await billingService.recordPayment({
    tenancyId: activeTenancyId,
    amount: '3000000.00',
    source: 'MANUAL_TRANSFER',
    verification: 'USER_RECORDED',
    confirmedAt: '2026-10-05T00:00:00.000Z',
  });

  tenantNotifs = await transactions.run(({ repositories }) =>
    repositories.notification.findNotificationsByRecipient(linkedTenantId),
  );
  assert.equal(tenantNotifs.length, 2);
  const paymentNotif = tenantNotifs.find((n) => n.category === 'PAYMENT_CONFIRMED');
  assert.ok(paymentNotif);
  assert.equal(paymentNotif.messageOrPayloadReference, `payment:${payment.id}`);
});

test('CX-04: Operator Tenancy Notice notifies linked tenant', async () => {
  const transactions = createCoreTestTransactionManager();
  const {
    tenantUserId: linkedTenantId,
    tenancyId: activeTenancyId,
    operatorUserId: ownerId,
  } = await setupOccupiedRental(transactions);

  const tenancyService = new TenancyService(transactions);
  const noticeService = new TenancyNoticeService(tenancyService, transactions);

  const notice = await noticeService.issue({
    tenancyId: activeTenancyId,
    noticeType: 'BUILDING_MAINTENANCE',
    issuedByUserId: ownerId,
    contentOrNote: 'Water system maintenance on Oct 10',
    issuedAt: '2026-10-02T10:00:00.000Z',
  });

  const tenantNotifs = await transactions.run(({ repositories }) =>
    repositories.notification.findNotificationsByRecipient(linkedTenantId),
  );
  assert.equal(tenantNotifs.length, 1);
  assert.equal(tenantNotifs[0]?.category, 'TENANCY_NOTICE');
  assert.equal(tenantNotifs[0]?.messageOrPayloadReference, `tenancy_notice:${notice.id}`);
});

test('CX-05: Tenancy move-out (startEnding) notifies operator without prematurely vacating Room', async () => {
  const transactions = createCoreTestTransactionManager();
  const { operatorUserId: ownerId, tenancyId: activeTenancyId, roomId: occupiedRoomId } =
    await setupOccupiedRental(transactions);

  const tenancyService = new TenancyService(transactions);
  await tenancyService.startEnding(activeTenancyId);

  const operatorNotifs = await transactions.run(({ repositories }) =>
    repositories.notification.findNotificationsByRecipient(ownerId),
  );
  assert.equal(operatorNotifs.length, 1);
  assert.equal(operatorNotifs[0]?.category, 'MOVE_OUT');
  assert.equal(operatorNotifs[0]?.messageOrPayloadReference, `tenancy:${activeTenancyId}`);

  const room = await transactions.run(({ repositories }) =>
    repositories.property.findRoom(occupiedRoomId),
  );
  assert.equal(room?.operationalState, 'OCCUPIED');
});

test('CX-06: Trust report submission on listing notifies operator', async () => {
  const transactions = createCoreTestTransactionManager();
  const { operatorUserId: ownerId, listingId: publishedId } = await setupPublishedListing(transactions);

  const trustService = new AuditTrustService(transactions);
  const report = await trustService.submitReport({
    listingId: publishedId,
    reason: 'MISLEADING_PRICE',
  });

  const operatorNotifs = await transactions.run(({ repositories }) =>
    repositories.notification.findNotificationsByRecipient(ownerId),
  );
  assert.equal(operatorNotifs.length, 1);
  assert.equal(operatorNotifs[0]?.category, 'REVIEW_OR_REPORT_MODERATION');
  assert.equal(operatorNotifs[0]?.messageOrPayloadReference, `trust_report:${report.id}`);
});
