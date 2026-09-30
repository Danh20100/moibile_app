import assert from 'node:assert/strict';
import test from 'node:test';

import { ForbiddenException } from '@nestjs/common';

import { ResourceAuthorizationService } from '../../src/common/auth/resource-authorization.service';
import type { VerifiedPrincipal } from '../../src/modules/identity-access/contracts';
import { BillingController } from '../../src/modules/billing/controllers/billing.controller';
import { BillingService } from '../../src/modules/billing/services/billing.service';
import { IncidentController } from '../../src/modules/incident/controllers/incident.controller';
import { IncidentService } from '../../src/modules/incident/services/incident.service';
import { InquiryController } from '../../src/modules/listing/controllers/inquiry.controller';
import { InquiryService } from '../../src/modules/listing/services/inquiry.service';
import { ListingController } from '../../src/modules/listing/controllers/listing.controller';
import { ListingService } from '../../src/modules/listing/services/listing.service';
import { OrganizationController } from '../../src/modules/organization/controllers/organization.controller';
import { OrganizationService } from '../../src/modules/organization/services/organization.service';
import { PropertyController } from '../../src/modules/property/controllers/property.controller';
import { PropertyService } from '../../src/modules/property/services/property.service';
import { ReceiptController } from '../../src/modules/receipt/controllers/receipt.controller';
import { ReceiptService } from '../../src/modules/receipt/services/receipt.service';
import { RentalLifecycleController } from '../../src/modules/rental-lifecycle/controllers/rental-lifecycle.controller';
import { RentalLifecycleCoordinator } from '../../src/modules/rental-lifecycle/services/rental-lifecycle.coordinator';
import { RoomController } from '../../src/modules/room/controllers/room.controller';
import { RoomService } from '../../src/modules/room/services/room.service';
import { TenancyController } from '../../src/modules/tenancy/controllers/tenancy.controller';
import { TenancySupportController } from '../../src/modules/tenancy/controllers/tenancy-support.controller';
import { TenancyNoticeService } from '../../src/modules/tenancy/services/tenancy-notice.service';
import { TenancyParticipantService } from '../../src/modules/tenancy/services/tenancy-participant.service';
import { TenancyService } from '../../src/modules/tenancy/services/tenancy.service';
import { TenancyTermsService } from '../../src/modules/tenancy/services/tenancy-terms.service';
import { TermsAcknowledgementService } from '../../src/modules/tenancy/services/terms-acknowledgement.service';
import { createCoreTestTransactionManager } from './support/in-memory-transaction-manager';

function createPrincipal(userId: string): VerifiedPrincipal {
  return {
    userId,
    provider: 'google',
    issuer: 'https://accounts.google.com',
    subject: `sub-${userId}`,
    email: `${userId}@example.com`,
  };
}

function setupTestEnvironment() {
  const transactions = createCoreTestTransactionManager();
  const authz = new ResourceAuthorizationService(transactions);

  const orgService = new OrganizationService(transactions);
  const orgController = new OrganizationController(orgService, authz);

  const propertyService = new PropertyService(orgService, transactions);
  const propertyController = new PropertyController(propertyService, authz);

  const roomService = new RoomService(propertyService, transactions);
  const roomController = new RoomController(roomService, authz);

  const listingService = new ListingService(transactions);
  const listingController = new ListingController(listingService, authz);

  const inquiryService = new InquiryService(listingService, transactions);
  const inquiryController = new InquiryController(inquiryService, authz);

  const tenancyService = new TenancyService(transactions);
  const tenancyController = new TenancyController(tenancyService, authz);

  const participantService = new TenancyParticipantService(tenancyService, transactions);
  const termsService = new TenancyTermsService(tenancyService, transactions);
  const ackService = new TermsAcknowledgementService(
    termsService,
    participantService,
    transactions,
  );
  const noticeService = new TenancyNoticeService(tenancyService, transactions);
  const tenancySupportController = new TenancySupportController(
    participantService,
    termsService,
    ackService,
    noticeService,
    authz,
  );

  const coordinator = new RentalLifecycleCoordinator(
    roomService,
    propertyService,
    listingService,
    tenancyService,
    participantService,
  );
  const lifecycleController = new RentalLifecycleController(coordinator, authz);

  const billingService = new BillingService(tenancyService, transactions);
  const billingController = new BillingController(billingService, authz);

  const receiptService = new ReceiptService(billingService, transactions);
  const receiptController = new ReceiptController(receiptService, authz);

  const incidentService = new IncidentService(roomService, transactions);
  const incidentController = new IncidentController(incidentService, authz);

  return {
    authz,
    orgController,
    propertyController,
    roomController,
    listingController,
    inquiryController,
    tenancyController,
    tenancySupportController,
    lifecycleController,
    billingController,
    receiptController,
    incidentController,
  };
}

test('Resource Authorization: Organization scoping & owner binding', async () => {
  const env = setupTestEnvironment();
  const userA = createPrincipal('user-a');
  const userB = createPrincipal('user-b');

  // User A creates an organization, attempting to set owner to user-spoofed
  const orgA = await env.orgController.create(
    { name: 'Khu Tro User A', primaryOwnerUserId: 'user-spoofed' },
    userA,
  );
  // Must be bound to userA.userId, ignoring client's spoofed authority
  assert.equal(orgA.primaryOwnerUserId, userA.userId);

  // User A lists organizations -> sees orgA
  const listA = await env.orgController.findAll(userA);
  assert.equal(listA.length, 1);
  assert.equal(listA[0].id, orgA.id);

  // User B lists organizations -> sees empty array
  const listB = await env.orgController.findAll(userB);
  assert.equal(listB.length, 0);

  // User B tries to read User A's organization -> 403 Forbidden
  await assert.rejects(
    () => env.orgController.findById(orgA.id, userB),
    (err: unknown) => err instanceof ForbiddenException,
  );

  // User B tries to update User A's organization -> 403 Forbidden
  await assert.rejects(
    () => env.orgController.update(orgA.id, { name: 'Hacked Org' }, userB),
    (err: unknown) => err instanceof ForbiddenException,
  );
});

test('Resource Authorization: Property & Room scoping and isolation', async () => {
  const env = setupTestEnvironment();
  const userA = createPrincipal('user-a');
  const userB = createPrincipal('user-b');

  const orgA = await env.orgController.create({ name: 'Org A' }, userA);

  // User B tries to create Property under User A's organization -> 403 Forbidden
  await assert.rejects(
    () =>
      env.propertyController.create(
        {
          organizationId: orgA.id,
          name: 'Nha Tro B hack',
          operationalAddressText: '123 Fake St',
          operationalLocation: { latitude: 21.0, longitude: 105.0 },
          publicLocationProjection: { latitude: 21.0, longitude: 105.0 },
        },
        userB,
      ),
    (err: unknown) => err instanceof ForbiddenException,
  );

  // User A creates property successfully
  const propA = await env.propertyController.create(
    {
      organizationId: orgA.id,
      name: 'Nha Tro User A',
      operationalAddressText: '123 Real St',
      operationalLocation: { latitude: 21.0, longitude: 105.0 },
      publicLocationProjection: { latitude: 21.0, longitude: 105.0 },
    },
    userA,
  );

  // User B tries to read User A's property -> 403 Forbidden
  await assert.rejects(
    () => env.propertyController.findById(propA.id, userB),
    (err: unknown) => err instanceof ForbiddenException,
  );

  // User B tries to update User A's property -> 403 Forbidden
  await assert.rejects(
    () => env.propertyController.update(propA.id, { name: 'Hacked Property' }, userB),
    (err: unknown) => err instanceof ForbiddenException,
  );

  // User B tries to create Room in User A's property -> 403 Forbidden
  await assert.rejects(
    () => env.roomController.create({ propertyId: propA.id, nameOrLabel: 'P101' }, userB),
    (err: unknown) => err instanceof ForbiddenException,
  );

  // User A creates room successfully
  const roomA = await env.roomController.create(
    { propertyId: propA.id, nameOrLabel: 'P101' },
    userA,
  );

  // User B tries to read User A's room (when not tenant) -> 403 Forbidden
  await assert.rejects(
    () => env.roomController.findById(roomA.id, userB),
    (err: unknown) => err instanceof ForbiddenException,
  );

  // User B tries to update User A's room -> 403 Forbidden
  await assert.rejects(
    () => env.roomController.update(roomA.id, { nameOrLabel: 'Hacked Room' }, userB),
    (err: unknown) => err instanceof ForbiddenException,
  );
});

test('Resource Authorization: Listing & Rental Lifecycle permissions', async () => {
  const env = setupTestEnvironment();
  const userA = createPrincipal('user-a');
  const userB = createPrincipal('user-b');

  const orgA = await env.orgController.create({ name: 'Org A' }, userA);
  const propA = await env.propertyController.create(
    {
      organizationId: orgA.id,
      name: 'Nha Tro A',
      operationalAddressText: '123 St',
      operationalLocation: { latitude: 21.0, longitude: 105.0 },
      publicLocationProjection: { latitude: 21.0, longitude: 105.0 },
    },
    userA,
  );
  const roomA = await env.roomController.create(
    { propertyId: propA.id, nameOrLabel: 'P101' },
    userA,
  );

  // User B tries to create listing for User A's room -> 403 Forbidden
  await assert.rejects(
    () =>
      env.lifecycleController.createListing(
        {
          roomId: roomA.id,
          publicTitle: 'Listing Title',
          publicDescription: 'Listing Desc',
          publicPriceProjection: '2500000.00',
          publicLocationProjection: { latitude: 21.0, longitude: 105.0 },
        },
        userB,
      ),
    (err: unknown) => err instanceof ForbiddenException,
  );

  // User A creates listing
  const listingA = await env.lifecycleController.createListing(
    {
      roomId: roomA.id,
      publicTitle: 'Listing Title',
      publicDescription: 'Listing Desc',
      publicPriceProjection: '2500000.00',
      publicLocationProjection: { latitude: 21.0, longitude: 105.0 },
    },
    userA,
  );

  // User B cannot read draft listing -> 403 Forbidden
  await assert.rejects(
    () => env.listingController.findById(listingA.id, userB),
    (err: unknown) => err instanceof ForbiddenException,
  );

  // User B cannot publish User A's listing -> 403 Forbidden
  await assert.rejects(
    () =>
      env.lifecycleController.publishListing(
        listingA.id,
        {
          reasonCode: 'MANUAL_PUBLISH',
          actorType: 'OPERATOR',
          trigger: 'MANUAL',
        },
        userB,
      ),
    (err: unknown) => err instanceof ForbiddenException,
  );

  // User B cannot update content of User A's listing -> 403 Forbidden
  await assert.rejects(
    () => env.listingController.update(listingA.id, { publicTitle: 'Hacked Listing' }, userB),
    (err: unknown) => err instanceof ForbiddenException,
  );

  // User B sends inquiry for listing A
  const inquiryB = await env.inquiryController.create(
    {
      listingId: listingA.id,
      contactIntentOrMessage: 'Interested in this room',
      status: 'NEW',
    },
    userB,
  );
  assert.equal(inquiryB.senderUserId, userB.userId);

  // User B (sender) can read inquiry
  const readBySender = await env.inquiryController.findById(inquiryB.id, userB);
  assert.equal(readBySender.id, inquiryB.id);

  // User A (operator) can read inquiry and list inquiries of listing A
  const readByOperator = await env.inquiryController.findById(inquiryB.id, userA);
  assert.equal(readByOperator.id, inquiryB.id);
  const operatorInquiries = await env.inquiryController.findByListingId(listingA.id, userA);
  assert.equal(operatorInquiries.length, 1);

  // Stranger User C cannot read inquiry of listing A -> 403 Forbidden
  const userC = createPrincipal('user-c');
  await assert.rejects(
    () => env.inquiryController.findById(inquiryB.id, userC),
    (err: unknown) => err instanceof ForbiddenException,
  );
  await assert.rejects(
    () => env.inquiryController.findByListingId(listingA.id, userC),
    (err: unknown) => err instanceof ForbiddenException,
  );
});

test('Resource Authorization: Tenancy, Tenant Linked access & Finance isolation', async () => {
  const env = setupTestEnvironment();
  const userA = createPrincipal('user-a'); // Operator
  const userB = createPrincipal('user-b'); // Tenant
  const userC = createPrincipal('user-c'); // Unrelated third party

  const orgA = await env.orgController.create({ name: 'Org A' }, userA);
  const propA = await env.propertyController.create(
    {
      organizationId: orgA.id,
      name: 'Nha Tro A',
      operationalAddressText: '123 St',
      operationalLocation: { latitude: 21.0, longitude: 105.0 },
      publicLocationProjection: { latitude: 21.0, longitude: 105.0 },
    },
    userA,
  );
  const roomA = await env.roomController.create(
    { propertyId: propA.id, nameOrLabel: 'P101' },
    userA,
  );

  // User B tries to create tenancy for room A -> 403 Forbidden
  await assert.rejects(
    () => env.lifecycleController.createTenancy({ roomId: roomA.id }, userB),
    (err: unknown) => err instanceof ForbiddenException,
  );

  // User A creates tenancy
  const tenancyA = await env.lifecycleController.createTenancy({ roomId: roomA.id }, userA);

  // User B cannot read tenancy before being added as participant -> 403 Forbidden
  await assert.rejects(
    () => env.tenancyController.findById(tenancyA.id, userB),
    (err: unknown) => err instanceof ForbiddenException,
  );

  // User A adds User B as primary participant
  const partB = await env.tenancySupportController.addParticipant(
    tenancyA.id,
    {
      userId: userB.userId,
      role: 'PRIMARY',
      joinedAt: '2026-09-30T14:00:00.000Z',
    },
    userA,
  );

  // User A creates tenancy terms
  const termsA = await env.tenancySupportController.createTerms(
    tenancyA.id,
    {
      version: 1,
      rentAmount: '3000000',
      agreedDepositRequirement: '3000000',
      termStart: '2026-10-01',
      termEnd: '2027-10-01',
      billingDayOrDueDateRule: {},
      electricityArrangement: {},
      waterArrangement: {},
      minimalRentalConditions: {},
      effectiveFromCycleBoundary: '2026-10-01',
    },
    userA,
  );

  // User B (linked tenant) can now read tenancy and room!
  const readTenancyByTenant = await env.tenancyController.findById(tenancyA.id, userB);
  assert.equal(readTenancyByTenant.id, tenancyA.id);

  const readRoomByTenant = await env.roomController.findById(roomA.id, userB);
  assert.equal(readRoomByTenant.id, roomA.id);

  // User B acknowledges terms -> succeeds
  await env.tenancySupportController.acknowledgeTerms(
    tenancyA.id,
    termsA.id,
    {
      tenancyParticipantId: partB.id,
      userId: 'spoofed',
      acknowledgedAt: '2026-09-30T14:05:00.000Z',
    },
    userB,
  );

  // User B (tenant) CANNOT cancel tenancy -> 403 Forbidden (operator only)
  await assert.rejects(
    () => env.tenancyController.cancel(tenancyA.id, userB),
    (err: unknown) => err instanceof ForbiddenException,
  );

  // User C (unrelated) CANNOT read tenancy -> 403 Forbidden
  await assert.rejects(
    () => env.tenancyController.findById(tenancyA.id, userC),
    (err: unknown) => err instanceof ForbiddenException,
  );

  // Finance: User A creates billing cycle
  const cycleA = await env.billingController.createCycle(
    {
      tenancyId: tenancyA.id,
      tenancyTermsId: termsA.id,
      periodStart: '2026-10-01',
      periodEnd: '2026-10-31',
      charges: [{ type: 'RENT', amount: '3000000.00' }],
    },
    userA,
  );

  // User C cannot read billing cycle -> 403 Forbidden
  await assert.rejects(
    () => env.billingController.findCycle(cycleA.id, userC),
    (err: unknown) => err instanceof ForbiddenException,
  );

  // User B (tenant) can read billing cycle -> Allowed
  const cycleRead = await env.billingController.findCycle(cycleA.id, userB);
  assert.equal(cycleRead.id, cycleA.id);

  // User A records payment
  const paymentA = await env.billingController.recordPayment(
    {
      tenancyId: tenancyA.id,
      amount: '3000000.00',
      source: 'MANUAL_TRANSFER',
      verification: 'USER_RECORDED',
      confirmedAt: '2026-10-02T10:00:00.000Z',
    },
    userA,
  );

  // User C cannot read payment -> 403 Forbidden
  await assert.rejects(
    () => env.billingController.findPayment(paymentA.id, userC),
    (err: unknown) => err instanceof ForbiddenException,
  );

  // User A issues receipt
  const receiptA = await env.receiptController.issue({ paymentId: paymentA.id }, userA);

  // User C cannot read or void receipt -> 403 Forbidden
  await assert.rejects(
    () => env.receiptController.findById(receiptA.id, userC),
    (err: unknown) => err instanceof ForbiddenException,
  );
  await assert.rejects(
    () => env.receiptController.void(receiptA.id, userC),
    (err: unknown) => err instanceof ForbiddenException,
  );
});

test('Resource Authorization: Incidents scoping and role boundaries', async () => {
  const env = setupTestEnvironment();
  const userA = createPrincipal('user-a'); // Operator
  const userB = createPrincipal('user-b'); // Tenant
  const userC = createPrincipal('user-c'); // Stranger

  const orgA = await env.orgController.create({ name: 'Org A' }, userA);
  const propA = await env.propertyController.create(
    {
      organizationId: orgA.id,
      name: 'Nha Tro A',
      operationalAddressText: '123 St',
      operationalLocation: { latitude: 21.0, longitude: 105.0 },
      publicLocationProjection: { latitude: 21.0, longitude: 105.0 },
    },
    userA,
  );
  const roomA = await env.roomController.create(
    { propertyId: propA.id, nameOrLabel: 'P101' },
    userA,
  );
  const tenancyA = await env.lifecycleController.createTenancy({ roomId: roomA.id }, userA);
  await env.tenancySupportController.addParticipant(
    tenancyA.id,
    {
      userId: userB.userId,
      role: 'PRIMARY',
      joinedAt: '2026-09-30T14:00:00.000Z',
    },
    userA,
  );

  // Stranger User C cannot report incident for User A's room -> 403 Forbidden
  await assert.rejects(
    () => env.incidentController.create({ roomId: roomA.id, category: 'PLUMBING' }, userC),
    (err: unknown) => err instanceof ForbiddenException,
  );

  // Tenant User B reports incident for their room -> 201 Created
  const incident = await env.incidentController.create(
    { roomId: roomA.id, category: 'PLUMBING' },
    userB,
  );
  assert.equal(incident.reportedByUserId, userB.userId);

  // Stranger User C cannot read incident -> 403 Forbidden
  await assert.rejects(
    () => env.incidentController.findById(incident.id, userC),
    (err: unknown) => err instanceof ForbiddenException,
  );

  // Tenant User B tries to transition incident status to ACKNOWLEDGED -> 403 Forbidden (operator only)
  await assert.rejects(
    () =>
      env.incidentController.updateStatus(
        incident.id,
        {
          status: 'ACKNOWLEDGED',
          note: 'Tenant cannot do this',
        },
        userB,
      ),
    (err: unknown) => err instanceof ForbiddenException,
  );

  // Operator User A transitions status -> Allowed
  const updatedIncident = await env.incidentController.updateStatus(
    incident.id,
    {
      status: 'ACKNOWLEDGED',
      note: 'Landlord acknowledged',
    },
    userA,
  );
  assert.equal(updatedIncident.status, 'ACKNOWLEDGED');
});
