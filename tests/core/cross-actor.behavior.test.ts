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

async function setupRentalHierarchy(transactions: ReturnType<typeof createCoreTestTransactionManager>) {
  const operatorUserId = '10000000-0000-4000-8000-000000000001';
  const tenantUserId = '10000000-0000-4000-8000-000000000002';
  const orgId = '20000000-0000-4000-8000-000000000001';
  const propertyId = '30000000-0000-4000-8000-000000000001';
  const roomId = '40000000-0000-4000-8000-000000000001';
  const listingId = '50000000-0000-4000-8000-000000000001';
  const tenancyId = '60000000-0000-4000-8000-000000000001';
  const participantId = '70000000-0000-4000-8000-000000000001';

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
      status: 'PUBLISHED',
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
      tenancyTermsId: 'terms-cross',
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

  return { operatorUserId, tenantUserId, orgId, propertyId, roomId, listingId, tenancyId, participantId, termsId: 'terms-cross' };
}

test('CX-01: Searcher Inquiry creates notification for Listing operator without side effects', async () => {
  const transactions = createCoreTestTransactionManager();
  const { operatorUserId, listingId, roomId } = await setupRentalHierarchy(transactions);

  const listings = new ListingService(transactions);
  const inquiries = new InquiryService(listings, transactions);

  const searcherUserId = 'searcher-user-id';
  const inquiry = await inquiries.create({
    listingId,
    senderUserId: searcherUserId,
    contactIntentOrMessage: 'Interested in this room',
    status: 'new',
  });

  const notifs = await transactions.run(({ repositories }) =>
    repositories.notification.findNotificationsByRecipient(operatorUserId),
  );
  assert.equal(notifs.length, 1);
  assert.equal(notifs[0]?.category, 'NEW_INQUIRY');
  assert.equal(notifs[0]?.messageOrPayloadReference, `inquiry:${inquiry.id}`);
  assert.equal(notifs[0]?.recipientUserId, operatorUserId);

  // Invariant: Listing status unchanged
  const currentListing = await listings.findById(listingId);
  assert.equal(currentListing.status, 'published');

  // Invariant: Room state unchanged
  const room = await transactions.run(({ repositories }) =>
    repositories.property.findRoom(roomId),
  );
  assert.equal(room?.operationalState, 'OCCUPIED');
});

test('CX-02: Tenant Incident creation and status transitions emit notifications to correct actors', async () => {
  const transactions = createCoreTestTransactionManager();
  const { operatorUserId, tenantUserId, roomId } = await setupRentalHierarchy(transactions);

  const orgService = new OrganizationService(transactions);
  const propertyService = new PropertyService(orgService, transactions);
  const roomService = new RoomService(propertyService, transactions);
  const incidentService = new IncidentService(roomService, transactions);

  // 1. Tenant reports incident -> notifies operator
  const incident = await incidentService.create({
    roomId,
    reportedByUserId: tenantUserId,
    category: 'PLUMBING',
  });

  let operatorNotifs = await transactions.run(({ repositories }) =>
    repositories.notification.findNotificationsByRecipient(operatorUserId),
  );
  assert.equal(operatorNotifs.length, 1);
  assert.equal(operatorNotifs[0]?.category, 'NEW_INCIDENT');
  assert.equal(operatorNotifs[0]?.messageOrPayloadReference, `incident:${incident.id}`);

  // 2. Operator updates status to ACKNOWLEDGED -> notifies tenant
  await incidentService.updateStatus(incident.id, {
    status: 'ACKNOWLEDGED',
    actorUserId: operatorUserId,
    note: 'Will inspect tomorrow',
  });

  let tenantNotifs = await transactions.run(({ repositories }) =>
    repositories.notification.findNotificationsByRecipient(tenantUserId),
  );
  assert.equal(tenantNotifs.length, 1);
  assert.equal(tenantNotifs[0]?.category, 'INCIDENT_STATUS_CHANGED');
  assert.equal(tenantNotifs[0]?.messageOrPayloadReference, `incident:${incident.id}`);
});

test('CX-03: Billing cycle due and payment confirmed notify linked tenant', async () => {
  const transactions = createCoreTestTransactionManager();
  const { tenantUserId, tenancyId } = await setupRentalHierarchy(transactions);

  const tenancyService = new TenancyService(transactions);
  const billingService = new BillingService(tenancyService, transactions);

  // 1. Billing cycle created -> PAYMENT_DUE notification for tenant
  const cycle = await billingService.createCycle({
    tenancyId,
    tenancyTermsId: 'terms-cross',
    periodStart: '2026-10-01',
    periodEnd: '2026-10-31',
    charges: [{ type: 'RENT', amount: '3000000.00' }],
  });

  let tenantNotifs = await transactions.run(({ repositories }) =>
    repositories.notification.findNotificationsByRecipient(tenantUserId),
  );
  assert.equal(tenantNotifs.length, 1);
  assert.equal(tenantNotifs[0]?.category, 'PAYMENT_DUE');
  assert.equal(tenantNotifs[0]?.messageOrPayloadReference, `billing_cycle:${cycle.id}`);

  // 2. Confirmed Payment recorded -> PAYMENT_CONFIRMED notification for tenant
  const payment = await billingService.recordPayment({
    tenancyId,
    amount: '3000000.00',
    source: 'MANUAL_TRANSFER',
    verification: 'USER_RECORDED',
    confirmedAt: '2026-10-05T00:00:00.000Z',
  });

  tenantNotifs = await transactions.run(({ repositories }) =>
    repositories.notification.findNotificationsByRecipient(tenantUserId),
  );
  assert.equal(tenantNotifs.length, 2);
  const paymentNotif = tenantNotifs.find((n) => n.category === 'PAYMENT_CONFIRMED');
  assert.ok(paymentNotif);
  assert.equal(paymentNotif.messageOrPayloadReference, `payment:${payment.id}`);
});

test('CX-04: Operator Tenancy Notice notifies linked tenant', async () => {
  const transactions = createCoreTestTransactionManager();
  const { tenantUserId, tenancyId, operatorUserId } = await setupRentalHierarchy(transactions);

  const tenancyService = new TenancyService(transactions);
  const noticeService = new TenancyNoticeService(tenancyService, transactions);

  const notice = await noticeService.issue({
    tenancyId,
    noticeType: 'BUILDING_MAINTENANCE',
    issuedByUserId: operatorUserId,
    contentOrNote: 'Water system maintenance on Oct 10',
    issuedAt: '2026-10-02T10:00:00.000Z',
  });

  const tenantNotifs = await transactions.run(({ repositories }) =>
    repositories.notification.findNotificationsByRecipient(tenantUserId),
  );
  assert.equal(tenantNotifs.length, 1);
  assert.equal(tenantNotifs[0]?.category, 'TENANCY_NOTICE');
  assert.equal(tenantNotifs[0]?.messageOrPayloadReference, `tenancy_notice:${notice.id}`);
});

test('CX-05: Tenancy move-out (startEnding) notifies operator without prematurely vacating Room', async () => {
  const transactions = createCoreTestTransactionManager();
  const { operatorUserId, tenancyId, roomId } = await setupRentalHierarchy(transactions);

  const tenancyService = new TenancyService(transactions);
  await tenancyService.startEnding(tenancyId);

  const operatorNotifs = await transactions.run(({ repositories }) =>
    repositories.notification.findNotificationsByRecipient(operatorUserId),
  );
  assert.equal(operatorNotifs.length, 1);
  assert.equal(operatorNotifs[0]?.category, 'MOVE_OUT');
  assert.equal(operatorNotifs[0]?.messageOrPayloadReference, `tenancy:${tenancyId}`);

  // Invariant: Room must NOT be vacant upon move-out initiation
  const room = await transactions.run(({ repositories }) =>
    repositories.property.findRoom(roomId),
  );
  assert.equal(room?.operationalState, 'OCCUPIED');
});

test('CX-06: Trust report submission on listing notifies operator', async () => {
  const transactions = createCoreTestTransactionManager();
  const { operatorUserId, listingId } = await setupRentalHierarchy(transactions);

  const trustService = new AuditTrustService(transactions);
  const report = await trustService.submitReport({
    listingId,
    reason: 'MISLEADING_PRICE',
  });

  const operatorNotifs = await transactions.run(({ repositories }) =>
    repositories.notification.findNotificationsByRecipient(operatorUserId),
  );
  assert.equal(operatorNotifs.length, 1);
  assert.equal(operatorNotifs[0]?.category, 'REVIEW_OR_REPORT_MODERATION');
  assert.equal(operatorNotifs[0]?.messageOrPayloadReference, `trust_report:${report.id}`);
});
