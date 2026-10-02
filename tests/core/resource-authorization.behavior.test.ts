import assert from 'node:assert/strict';
import test from 'node:test';

import { ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';

import { ResourceAuthorizationService } from '../../src/common/auth/resource-authorization.service';
import type { VerifiedPrincipal } from '../../src/modules/identity-access/contracts';
import { BillingController } from '../../src/modules/billing/controllers/billing.controller';
import { BillingService } from '../../src/modules/billing/services/billing.service';
import { HistoryController } from '../../src/modules/history/controllers/history.controller';
import { RentalHistoryService } from '../../src/modules/history/services/rental-history.service';
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

  const rentalHistoryService = new RentalHistoryService(
    tenancyService,
    termsService,
    billingService,
    receiptService,
    noticeService,
    incidentService,
    roomService,
    listingService,
  );
  const historyController = new HistoryController(rentalHistoryService, authz);

  return {
    authz,
    orgController,
    propertyController,
    roomController,
    listingController,
    listingService,
    inquiryController,
    tenancyController,
    tenancySupportController,
    lifecycleController,
    billingController,
    receiptController,
    incidentController,
    historyController,
  };
}

test('Resource Authorization: Organization scoping & owner binding', async () => {
  const env = setupTestEnvironment();
  const userA = createPrincipal('user-a');
  const userB = createPrincipal('user-b');

  // User A creates an organization, attempting to set owner to user-spoofed
  const orgA = await env.orgController.create(
    { name: 'Khu Tro User A', primaryOwnerUserId: 'user-spoofed' } as never,
    userA,
  );
  // Must be bound to userA.userId, ignoring client's spoofed authority
  assert.equal(orgA.primaryOwnerUserId, userA.userId);

  // Protected creation must fail closed when no verified principal is present.
  await assert.rejects(
    () =>
      env.orgController.create(
        { name: 'Spoofed Workspace', primaryOwnerUserId: 'user-spoofed' } as never,
        undefined,
      ),
    (err: unknown) => err instanceof UnauthorizedException,
  );

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

  // No current Listing is explicit before the operator creates one.
  await assert.rejects(
    () => env.listingController.findCurrentByRoomId(roomA.id, userA),
    (err: unknown) => err instanceof NotFoundException,
  );

  // User B tries to discover User A's current Room Listing -> 403 Forbidden
  await assert.rejects(
    () => env.listingController.findCurrentByRoomId(roomA.id, userB),
    (err: unknown) => err instanceof ForbiddenException,
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

  const currentListingA = await env.listingController.findCurrentByRoomId(roomA.id, userA);
  assert.equal(currentListingA.id, listingA.id);

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
        userB,
      ),
    (err: unknown) => err instanceof ForbiddenException,
  );

  const publishedByOwner = await env.lifecycleController.publishListing(listingA.id, userA);
  assert.equal(publishedByOwner.status, 'published');
  const publishEvents = await env.listingService.listStatusEvents(listingA.id);
  assert.equal(publishEvents.at(-1)?.reasonCode, 'MANUAL_PUBLISH');
  assert.equal(publishEvents.at(-1)?.actorType, 'USER');
  assert.equal(publishEvents.at(-1)?.actorUserId, userA.userId);
  assert.equal(publishEvents.at(-1)?.trigger, 'COMMAND');

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

  // User B acknowledges terms; actor identity is derived from the verified principal.
  const termsAck = await env.tenancySupportController.acknowledgeTerms(
    tenancyA.id,
    termsA.id,
    {
      tenancyParticipantId: partB.id,
      acknowledgedAt: '2026-09-30T14:05:00.000Z',
    },
    userB,
  );
  assert.equal(termsAck.userId, userB.userId);

  await assert.rejects(
    () =>
      env.tenancySupportController.acknowledgeTerms(
        tenancyA.id,
        termsA.id,
        {
          tenancyParticipantId: partB.id,
          acknowledgedAt: '2026-09-30T14:06:00.000Z',
        },
        undefined,
      ),
    (err: unknown) => err instanceof UnauthorizedException,
  );

  // Notice issue is operator-owned, while acknowledgement is participant-owned.
  await assert.rejects(
    () =>
      env.tenancySupportController.issueNotice(
        tenancyA.id,
        {
          noticeType: 'MOVE_OUT_REMINDER',
          contentOrNote: 'Tenant cannot issue this notice',
          issuedAt: '2026-09-30T14:07:00.000Z',
        },
        userB,
      ),
    (err: unknown) => err instanceof ForbiddenException,
  );

  const notice = await env.tenancySupportController.issueNotice(
    tenancyA.id,
    {
      noticeType: 'MOVE_OUT_REMINDER',
      contentOrNote: 'Please review the move-out timeline',
      issuedAt: '2026-09-30T14:08:00.000Z',
    },
    userA,
  );
  assert.equal(notice.issuedByUserId, userA.userId);

  await assert.rejects(
    () =>
      env.tenancySupportController.acknowledgeNotice(
        tenancyA.id,
        notice.id,
        { occurredAt: '2026-09-30T14:09:00.000Z' },
        userA,
      ),
    (err: unknown) => err instanceof ForbiddenException,
  );

  const acknowledgedNotice = await env.tenancySupportController.acknowledgeNotice(
    tenancyA.id,
    notice.id,
    { occurredAt: '2026-09-30T14:10:00.000Z' },
    userB,
  );
  assert.equal(acknowledgedNotice.acknowledgedByUserId, userB.userId);

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

  const tenantPaymentHistory = await env.billingController.findPaymentsByTenancy(
    tenancyA.id,
    userB,
  );
  assert.deepEqual(tenantPaymentHistory.map((payment) => payment.id), [paymentA.id]);

  const operatorPaymentHistory = await env.billingController.findPaymentsByTenancy(
    tenancyA.id,
    userA,
  );
  assert.deepEqual(operatorPaymentHistory.map((payment) => payment.id), [paymentA.id]);

  // User C cannot read payment or Payment history -> 403 Forbidden
  await assert.rejects(
    () => env.billingController.findPayment(paymentA.id, userC),
    (err: unknown) => err instanceof ForbiddenException,
  );
  await assert.rejects(
    () => env.billingController.findPaymentsByTenancy(tenancyA.id, userC),
    (err: unknown) => err instanceof ForbiddenException,
  );

  // Deposit lifecycle is discoverable by Tenancy; only the operator initializes and settles it.
  await assert.rejects(
    () => env.billingController.createDeposit({ tenancyId: tenancyA.id }, userB),
    (err: unknown) => err instanceof ForbiddenException,
  );

  const deposit = await env.billingController.createDeposit({ tenancyId: tenancyA.id }, userA);
  assert.equal(deposit.tenancyId, tenancyA.id);
  assert.equal(deposit.requirementAmount, '3000000');
  assert.equal(deposit.fundedAmount, '0.00');
  assert.equal(deposit.state, 'EXPECTED');
  assert.equal(deposit.blockedByOpenPolicy, false);

  const tenantDeposit = await env.billingController.findDepositByTenancy(tenancyA.id, userB);
  assert.equal(tenantDeposit.id, deposit.id);

  await assert.rejects(
    () => env.billingController.findDepositByTenancy(tenancyA.id, userC),
    (err: unknown) => err instanceof ForbiddenException,
  );

  await env.billingController.applyDeposit(
    paymentA.id,
    { targetId: deposit.id, amount: '3000000.00' },
    userA,
  );
  const heldDeposit = await env.billingController.findDepositByTenancy(tenancyA.id, userB);
  assert.equal(heldDeposit.fundedAmount, '3000000.00');
  assert.equal(heldDeposit.heldAmount, '3000000.00');
  assert.equal(heldDeposit.state, 'HELD');

  await assert.rejects(
    () =>
      env.billingController.settleDeposit(
        deposit.id,
        {
          refundedAmount: '2500000.00',
          retainedAmount: '500000.00',
          reasonOrNote: 'Tenant cannot settle the deposit',
          settledAt: '2026-10-03T10:00:00.000Z',
        },
        userB,
      ),
    (err: unknown) => err instanceof ForbiddenException,
  );

  const settlement = await env.billingController.settleDeposit(
    deposit.id,
    {
      refundedAmount: '2500000.00',
      retainedAmount: '500000.00',
      reasonOrNote: 'Final checkout settlement',
      settledAt: '2026-10-03T10:05:00.000Z',
    },
    userA,
  );
  assert.equal(settlement.actedByUserId, userA.userId);

  const depositEvents = await env.billingController.findDepositEvents(deposit.id, userB);
  assert.deepEqual(depositEvents.map((event) => event.eventType), ['RECEIVED', 'REFUNDED', 'RETAINED']);
  const settledDeposit = await env.billingController.findDepositByTenancy(tenancyA.id, userB);
  assert.equal(settledDeposit.settledAmount, '3000000.00');
  assert.equal(settledDeposit.heldAmount, '0.00');
  assert.equal(settledDeposit.state, 'SETTLED');

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

  // Stranger User C cannot read incident or its event timeline -> 403 Forbidden
  await assert.rejects(
    () => env.incidentController.findById(incident.id, userC),
    (err: unknown) => err instanceof ForbiddenException,
  );
  await assert.rejects(
    () => env.incidentController.listEvents(incident.id, userC),
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

  const tenantTimeline = await env.incidentController.listEvents(incident.id, userB);
  assert.deepEqual(tenantTimeline.map((event) => event.toStatus), ['REPORTED', 'ACKNOWLEDGED']);
  assert.ok(
    tenantTimeline.every(
      (event, index, all) => index === 0 || all[index - 1].occurredAt <= event.occurredAt,
    ),
  );

  const operatorTimeline = await env.incidentController.listEvents(incident.id, userA);
  assert.deepEqual(operatorTimeline.map((event) => event.id), tenantTimeline.map((event) => event.id));
});

test('Resource Authorization: operator Room history composes source-backed listing, rental, finance, and incident facts', async () => {
  const env = setupTestEnvironment();
  const operator = createPrincipal('operator-room-history');
  const tenant = createPrincipal('tenant-room-history');
  const stranger = createPrincipal('stranger-room-history');

  const org = await env.orgController.create({ name: 'Operational History Org' }, operator);
  const property = await env.propertyController.create(
    {
      organizationId: org.id,
      name: 'Operational History Property',
      operationalAddressText: 'Private source address',
      operationalLocation: { latitude: 10.77, longitude: 106.69 },
      publicLocationProjection: { latitude: 10.771, longitude: 106.691 },
    },
    operator,
  );
  const room = await env.roomController.create(
    { propertyId: property.id, nameOrLabel: 'OH-01' },
    operator,
  );
  const listing = await env.lifecycleController.createListing(
    {
      roomId: room.id,
      publicTitle: 'Operational History Listing',
      publicDescription: 'Public history fixture',
      publicPriceProjection: '3000000.00',
      publicLocationProjection: { latitude: 10.771, longitude: 106.691 },
    },
    operator,
  );
  await env.lifecycleController.publishListing(listing.id, operator);

  const tenancy = await env.lifecycleController.createTenancy({ roomId: room.id }, operator);
  await env.tenancySupportController.addParticipant(
    tenancy.id,
    {
      userId: tenant.userId,
      role: 'PRIMARY',
      joinedAt: '2026-09-01T00:00:00.000Z',
    },
    operator,
  );
  await env.lifecycleController.activateTenancy(
    tenancy.id,
    { occurredAt: '2026-09-01T00:00:00.000Z' },
    operator,
  );
  const terms = await env.tenancySupportController.createTerms(
    tenancy.id,
    {
      version: 1,
      rentAmount: '3000000.00',
      agreedDepositRequirement: '3000000.00',
      termStart: '2026-09-01',
      termEnd: '2027-08-31',
      billingDayOrDueDateRule: {},
      electricityArrangement: {},
      waterArrangement: {},
      minimalRentalConditions: {},
      effectiveFromCycleBoundary: '2026-09-01',
    },
    operator,
  );
  const cycle = await env.billingController.createCycle(
    {
      tenancyId: tenancy.id,
      tenancyTermsId: terms.id,
      periodStart: '2026-09-01',
      periodEnd: '2026-09-30',
      charges: [{ type: 'RENT', amount: '3000000.00' }],
    },
    operator,
  );
  const payment = await env.billingController.recordPayment(
    {
      tenancyId: tenancy.id,
      amount: '3000000.00',
      source: 'MANUAL_TRANSFER',
      verification: 'USER_RECORDED',
      confirmedAt: '2026-09-05T00:00:00.000Z',
    },
    operator,
  );
  const receipt = await env.receiptController.issue({ paymentId: payment.id }, operator);
  const deposit = await env.billingController.createDeposit({ tenancyId: tenancy.id }, operator);
  await env.billingController.applyDeposit(
    payment.id,
    { targetId: deposit.id, amount: '1000000.00' },
    operator,
  );
  const incident = await env.incidentController.create(
    { roomId: room.id, category: 'PLUMBING' },
    tenant,
  );

  const history = await env.historyController.findByRoom(room.id, operator);
  assert.equal(history.room.id, room.id);
  assert.equal(history.room.operationalState, 'occupied');
  assert.deepEqual(history.listings.map((item) => item.listing.id), [listing.id]);
  assert.equal(history.listings[0]?.events.length, 2);
  assert.deepEqual(
    [...(history.listings[0]?.events ?? [])].map((event) => event.toStatus).sort(),
    ['published', 'unpublished'].sort(),
  );
  assert.ok(
    (history.listings[0]?.events ?? []).every(
      (event, index, all) => index === 0 ||
        all[index - 1].occurredAt < event.occurredAt ||
        (all[index - 1].occurredAt === event.occurredAt && all[index - 1].id <= event.id),
    ),
  );
  assert.deepEqual(history.tenancies.map((item) => item.tenancy.id), [tenancy.id]);
  assert.deepEqual(history.tenancies[0]?.billingCycles.map((item) => item.id), [cycle.id]);
  assert.deepEqual(history.tenancies[0]?.payments.map((item) => item.payment.id), [payment.id]);
  assert.deepEqual(history.tenancies[0]?.payments[0]?.receipts.map((item) => item.id), [receipt.id]);
  assert.equal(history.tenancies[0]?.deposit?.projection.id, deposit.id);
  assert.deepEqual(history.tenancies[0]?.deposit?.events.map((event) => event.eventType), ['RECEIVED']);
  assert.deepEqual(history.incidents.map((item) => item.incident.id), [incident.id]);
  assert.deepEqual(history.incidents[0]?.events.map((event) => event.toStatus), ['REPORTED']);

  await assert.rejects(
    () => env.historyController.findByRoom(room.id, stranger),
    (err: unknown) => err instanceof ForbiddenException,
  );
});

test('Resource Authorization: former tenant keeps historical reads but loses operational writes', async () => {
  const env = setupTestEnvironment();
  const operator = createPrincipal('operator-history');
  const formerTenant = createPrincipal('former-tenant');
  const stranger = createPrincipal('history-stranger');

  const org = await env.orgController.create({ name: 'History Org' }, operator);
  const property = await env.propertyController.create(
    {
      organizationId: org.id,
      name: 'History Property',
      operationalAddressText: 'History Address',
      operationalLocation: { latitude: 10.77, longitude: 106.69 },
      publicLocationProjection: { latitude: 10.77, longitude: 106.69 },
    },
    operator,
  );
  const room = await env.roomController.create(
    { propertyId: property.id, nameOrLabel: 'H-01' },
    operator,
  );
  const tenancy = await env.lifecycleController.createTenancy({ roomId: room.id }, operator);
  const participant = await env.tenancySupportController.addParticipant(
    tenancy.id,
    {
      userId: formerTenant.userId,
      role: 'OCCUPANT',
      joinedAt: '2026-01-01T00:00:00.000Z',
    },
    operator,
  );
  const terms = await env.tenancySupportController.createTerms(
    tenancy.id,
    {
      version: 1,
      rentAmount: '3000000',
      agreedDepositRequirement: '3000000',
      termStart: '2026-01-01',
      termEnd: '2026-12-31',
      billingDayOrDueDateRule: {},
      electricityArrangement: {},
      waterArrangement: {},
      minimalRentalConditions: {},
      effectiveFromCycleBoundary: '2026-01-01',
    },
    operator,
  );
  const cycle = await env.billingController.createCycle(
    {
      tenancyId: tenancy.id,
      tenancyTermsId: terms.id,
      periodStart: '2026-01-01',
      periodEnd: '2026-01-31',
      charges: [{ type: 'RENT', amount: '3000000.00' }],
    },
    operator,
  );
  const payment = await env.billingController.recordPayment(
    {
      tenancyId: tenancy.id,
      amount: '3000000.00',
      source: 'MANUAL_TRANSFER',
      verification: 'USER_RECORDED',
      confirmedAt: '2026-01-02T00:00:00.000Z',
    },
    operator,
  );
  const receipt = await env.receiptController.issue({ paymentId: payment.id }, operator);

  await env.tenancySupportController.leaveOccupant(
    tenancy.id,
    participant.id,
    { occurredAt: '2026-02-01T00:00:00.000Z' },
    operator,
  );

  assert.equal((await env.tenancyController.findById(tenancy.id, formerTenant)).id, tenancy.id);
  assert.equal(
    (await env.tenancySupportController.listTerms(tenancy.id, formerTenant))[0].id,
    terms.id,
  );
  assert.equal((await env.billingController.findCycle(cycle.id, formerTenant)).id, cycle.id);
  assert.equal((await env.billingController.findPayment(payment.id, formerTenant)).id, payment.id);
  assert.deepEqual(
    (await env.billingController.findPaymentsByTenancy(tenancy.id, formerTenant)).map((item) => item.id),
    [payment.id],
  );
  assert.equal((await env.receiptController.findById(receipt.id, formerTenant)).id, receipt.id);

  const history = await env.historyController.findByTenancy(tenancy.id, formerTenant);
  assert.equal(history.tenancy.id, tenancy.id);
  assert.deepEqual(history.terms.map((item) => item.id), [terms.id]);
  assert.deepEqual(history.payments.map((item) => item.payment.id), [payment.id]);
  assert.deepEqual(history.payments[0]?.receipts.map((item) => item.id), [receipt.id]);
  assert.deepEqual(history.notices, []);
  assert.deepEqual(history.incidents, []);
  assert.equal(history.deposit, null);

  const operatorHistory = await env.historyController.findByTenancy(tenancy.id, operator);
  assert.equal(operatorHistory.tenancy.id, tenancy.id);

  await assert.rejects(
    () => env.historyController.findByTenancy(tenancy.id, stranger),
    (err: unknown) => err instanceof ForbiddenException,
  );

  await assert.rejects(
    () =>
      env.tenancySupportController.acknowledgeTerms(
        tenancy.id,
        terms.id,
        {
          tenancyParticipantId: participant.id,
          acknowledgedAt: '2026-02-02T00:00:00.000Z',
        },
        formerTenant,
      ),
    (err: unknown) => err instanceof ForbiddenException,
  );
});
