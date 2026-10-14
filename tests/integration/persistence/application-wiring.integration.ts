import assert from 'node:assert/strict';
import test from 'node:test';
import { applicationRestartFixture as F } from '../../support/application-restart-fixtures';

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
import { BillingService } from '../../../src/modules/billing/services/billing.service';
import { ReceiptService } from '../../../src/modules/receipt/services/receipt.service';
import { IncidentService } from '../../../src/modules/incident/services/incident.service';
import { RentalLifecycleCoordinator } from '../../../src/modules/rental-lifecycle/services/rental-lifecycle.coordinator';
import { AuditTrustService } from '../../../src/modules/audit-trust/services/audit-trust.service';
import { runMigrations } from '../../../scripts/database/migrate';
import { assertSafeTestDatabaseUrl, resetPublicSchema } from './support/postgres-test-harness';
import { listingAssetFixture } from '../../support/listing-asset-fixtures';

function runtime(databaseUrl: string) {
  const database = createDatabaseClient({
    url: databaseUrl,
    maxPoolSize: 4,
    connectionTimeoutMs: 5000,
  });
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
  const billing = new BillingService(tenancies, transactions);
  const receipts = new ReceiptService(billing, transactions);
  const incidents = new IncidentService(rooms, transactions);
  const trust = new AuditTrustService(transactions);
  const rentalLifecycle = new RentalLifecycleCoordinator(rooms, properties, listings, tenancies, participants);
  return {
    database,
    transactions,
    organizations,
    properties,
    rooms,
    listings,
    inquiries,
    tenancies,
    participants,
    terms,
    acknowledgements,
    notices,
    billing,
    receipts,
    incidents,
    trust,
    rentalLifecycle,
  };
}

test('core application state remains readable after database client restart', async () => {
  const databaseUrl = process.env.TEST_DATABASE_URL;
  assert.ok(databaseUrl, 'TEST_DATABASE_URL is required');
  assertSafeTestDatabaseUrl(databaseUrl);
  await resetPublicSchema(databaseUrl);
  await runMigrations('up', databaseUrl);

  const first = runtime(databaseUrl);
  let firstClosed: boolean = false;
  try {
    const ownerId = F.values.ownerId;
    const tenantId = F.values.tenantId;
    await first.transactions.run(async ({ repositories }) => {
      await repositories.identity.ensureUser(ownerId);
      await repositories.identity.ensureUser(tenantId);
    });
    const organization = await first.organizations.create({
      name: F.values.organizationName,
      primaryOwnerUserId: ownerId,
    });
    const propertyInput = {
      id: F.values.propertyId,
      organizationId: organization.id,
      name: F.values.propertyName,
      operationalAddressText: F.values.operationalAddress,
      operationalLocation: F.values.operationalLocation,
      publicLocationProjection: F.values.propertyPublicLocation,
    };
    const propertyResults = await Promise.all([first.properties.create(propertyInput), first.properties.create(propertyInput)]);
    const property = propertyResults[0]!;
    assert.equal(propertyResults[1]!.id, property.id);
    await assert.rejects(first.properties.create({ ...propertyInput, name: listingAssetFixture.idempotencyConflicts.propertyName }));
    const roomInput = {
      id: F.values.roomId,
      propertyId: property.id,
      nameOrLabel: F.values.roomLabel,
    };
    const roomResults = await Promise.all([first.rooms.create(roomInput), first.rooms.create(roomInput)]);
    const room = roomResults[0]!;
    assert.equal(roomResults[1]!.id, room.id);
    await assert.rejects(first.rooms.create({ ...roomInput, nameOrLabel: listingAssetFixture.idempotencyConflicts.roomNameOrLabel }));
    const listingInput = {
      id: F.values.listingId,
      roomId: room.id,
      publicTitle: F.values.listingTitle,
      publicDescription: F.values.listingDescription,
      publicPriceProjection: F.values.listingPrice,
      publicLocationProjection: F.values.listingPublicLocation,
    };
    const listingResults = await Promise.all([first.listings.createDraft(listingInput), first.listings.createDraft(listingInput)]);
    const listing = listingResults[0]!;
    assert.equal(listingResults[1]!.id, listing.id);
    await assert.rejects(first.listings.createDraft({ ...listingInput, publicTitle: listingAssetFixture.idempotencyConflicts.listingTitle }));
    const assetDetails = { ...listingAssetFixture.details, managementStatus: F.values.activeAssetManagementStatus };
    await first.listings.saveAssetDetails(listing.id, assetDetails);
    assert.deepEqual(await first.listings.findAssetDetails(listing.id), { listingId: listing.id, ...assetDetails });
    const published = await first.rentalLifecycle.publishListing(listing.id, {
      reasonCode: F.values.publishReason,
      actorType: F.values.publishActorType,
      actorUserId: ownerId,
      trigger: F.values.publishTrigger,
    });
    assert.equal(published.status, F.values.publishedListingStatus);
    const report = await first.trust.submitReport(
      { listingId: published.id, reason: F.values.trustReportReason },
      ownerId,
    );
    const inquiry = await first.inquiries.create({
      listingId: listing.id,
      contactIntentOrMessage: F.values.inquiryMessage,
      status: F.values.inquiryStatus,
    });
    const tenancy = await first.rentalLifecycle.createTenancy(room.id);
    const participant = await first.participants.add({
      tenancyId: tenancy.id,
      userId: tenantId,
      role: F.values.participantRole,
      joinedAt: F.values.joinedAt,
    });
    assert.equal(participant.userId, tenantId);
    assert.notEqual(participant.userId, ownerId);
    const terms = await first.terms.createVersion({
      tenancyId: tenancy.id,
      version: F.values.termsVersion,
      rentAmount: F.values.rentAmount,
      agreedDepositRequirement: F.values.depositRequirement,
      termStart: F.values.termStart,
      termEnd: F.values.termEnd,
      billingDayOrDueDateRule: F.values.billingDayRule,
      electricityArrangement: F.values.electricityArrangement,
      waterArrangement: F.values.waterArrangement,
      minimalRentalConditions: F.values.rentalConditions,
      effectiveFromCycleBoundary: F.values.effectiveBoundary,
    });
    const acknowledgement = await first.acknowledgements.acknowledge({
      tenancyTermsId: terms.id,
      tenancyParticipantId: participant.id,
      userId: tenantId,
      acknowledgedAt: F.values.acknowledgedAt,
    });
    const activeTenancy = await first.rentalLifecycle.activateTenancy(tenancy.id, {
      reasonCode: F.values.publishReason,
      actorType: F.values.publishActorType,
      actorUserId: ownerId,
      trigger: F.values.publishTrigger,
    }, F.values.tenancyActivatedAt);
    assert.equal(activeTenancy.status, F.expected.tenancyStatusAfterActivation);
    const occupiedRoom = await first.rooms.findById(room.id);
    const notice = await first.notices.issue({
      tenancyId: tenancy.id,
      noticeType: F.values.noticeType,
      issuedByUserId: ownerId,
      contentOrNote: F.values.noticeContent,
      issuedAt: F.values.noticeIssuedAt,
    });
    const cycle = await first.billing.createCycle({
      tenancyId: tenancy.id,
      tenancyTermsId: terms.id,
      periodStart: F.values.cycleStart,
      periodEnd: F.values.cycleEnd,
      charges: F.values.charges,
    });
    assert.equal(cycle.charges[0]?.outstandingAmount, F.expected.initialOutstanding);
    const payment = await first.billing.recordPayment({
      tenancyId: tenancy.id,
      amount: F.values.paymentAmount,
      source: F.values.paymentSource,
      confirmedAt: F.values.paymentConfirmedAt,
    });
    assert.equal(payment.source, F.values.paymentSource);
    assert.equal(payment.verification, F.expected.paymentVerification);
    await first.billing.allocatePayment(
      payment.id,
      cycle.charges[0]!.id,
      F.values.billingAllocationAmount,
    );
    const deposit = await first.billing.createDeposit(tenancy.id);
    await first.billing.applyPaymentToDeposit(
      payment.id,
      deposit.id,
      F.values.depositApplicationAmount,
    );
    const receipt = await first.receipts.issue(payment.id);
    const incident = await first.incidents.create({
      roomId: room.id,
      reportedByUserId: ownerId,
      category: F.values.incidentCategory,
    });
    await first.incidents.updateStatus(incident.id, {
      status: F.values.acknowledgedIncidentStatus,
      actorUserId: ownerId,
    });
    await assert.rejects(
      first.incidents.updateStatus(incident.id, F.values.unauthorizedIncidentUpdate),
    );
    assert.equal(
      (await first.incidents.findById(incident.id)).status,
      F.values.expectedIncidentStatusBeforeRestart,
    );
    const allocatedCycle = await first.billing.findById(cycle.id);
    assert.equal(allocatedCycle.charges[0]?.outstandingAmount, F.expected.remainingOutstanding);
    await first.database.destroy();
    firstClosed = true;

    const second = runtime(databaseUrl);
    try {
      assert.deepEqual(await second.organizations.findById(organization.id), organization);
      assert.deepEqual(await second.properties.findById(property.id), property);
      assert.deepEqual(await second.rooms.findById(room.id), room);
      const restartedListing = await second.listings.findById(listing.id);
      assert.equal(restartedListing.status, F.expected.listingStatusAfterActivation);
      assert.deepEqual(await second.listings.findAssetDetails(listing.id), { listingId: listing.id, ...assetDetails });
      assert.deepEqual(await second.inquiries.findById(inquiry.id), inquiry);
      assert.deepEqual(await second.tenancies.findById(activeTenancy.id), activeTenancy);
      assert.deepEqual(await second.rooms.findById(room.id), occupiedRoom);
      assert.deepEqual(await second.participants.findById(participant.id), participant);
      assert.deepEqual(await second.terms.findById(terms.id), terms);
      assert.deepEqual(await second.acknowledgements.listByTermsId(terms.id), [acknowledgement]);
      assert.deepEqual(await second.notices.findById(notice.id), notice);
      const restartedCycle = await second.billing.findById(cycle.id);
      assert.deepEqual(restartedCycle, allocatedCycle);
      assert.equal(restartedCycle.charges[0]?.outstandingAmount, F.expected.remainingOutstanding);
      const restartedPayment = await second.billing.findPaymentById(payment.id);
      assert.deepEqual(restartedPayment, payment);
      assert.equal(restartedPayment.source, F.values.paymentSource);
      assert.equal(restartedPayment.verification, F.expected.paymentVerification);
      assert.deepEqual(
        (await second.billing.listDepositEvents(deposit.id)).map((event) => event.eventType),
        F.values.expectedDepositEvents,
      );
      assert.deepEqual(await second.receipts.findById(receipt.id), receipt);
      assert.equal(
        (await second.incidents.findById(incident.id)).status,
        F.values.expectedIncidentStatusAfterRestart,
      );
      assert.deepEqual(
        (await second.incidents.listEvents(incident.id)).map((event) => event.toStatus),
        F.values.expectedIncidentEvents,
      );
      const stored = await second.transactions.run(({ repositories }) =>
        repositories.trust.findTrustReports(),
      );
      assert.equal(stored.length, F.values.expectedTrustReportCount);
      assert.equal(stored[0]?.trustReportId, report.id);
      assert.equal(stored[0]?.reporterUserId, ownerId);
      assert.equal(stored[0]?.listingId, published.id);
    } finally {
      await second.database.destroy();
    }
  } finally {
    if (!firstClosed) await first.database.destroy();
  }
});
