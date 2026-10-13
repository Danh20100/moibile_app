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
import { AuditTrustService } from '../../../src/modules/audit-trust/services/audit-trust.service';
import { runMigrations } from '../../../scripts/database/migrate';
import { resetPublicSchema } from './support/postgres-test-harness';

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
  };
}

test('core application state remains readable after database client restart', async () => {
  const databaseUrl = process.env.TEST_DATABASE_URL;
  assert.ok(databaseUrl, 'TEST_DATABASE_URL is required');
  await resetPublicSchema(databaseUrl);
  await runMigrations('up', databaseUrl);

  const first = runtime(databaseUrl);
  let firstClosed: boolean = false;
  try {
    const ownerId = F.values.ownerId;
    await first.transactions.run(({ repositories }) => repositories.identity.ensureUser(ownerId));
    const organization = await first.organizations.create({
      name: F.values.organizationName,
      primaryOwnerUserId: ownerId,
    });
    const property = await first.properties.create({
      organizationId: organization.id,
      name: F.values.propertyName,
      operationalAddressText: F.values.operationalAddress,
      operationalLocation: F.values.operationalLocation,
      publicLocationProjection: F.values.propertyPublicLocation,
    });
    const room = await first.rooms.create({
      propertyId: property.id,
      nameOrLabel: F.values.roomLabel,
    });
    const listing = await first.listings.createDraft({
      roomId: room.id,
      publicTitle: F.values.listingTitle,
      publicDescription: F.values.listingDescription,
      publicPriceProjection: F.values.listingPrice,
      publicLocationProjection: F.values.listingPublicLocation,
    });
    const inquiry = await first.inquiries.create({
      listingId: listing.id,
      contactIntentOrMessage: F.values.inquiryMessage,
      status: F.values.inquiryStatus,
    });
    const tenancy = await first.tenancies.createDraft(room.id);
    const participant = await first.participants.add({
      tenancyId: tenancy.id,
      userId: ownerId,
      role: F.values.participantRole,
      joinedAt: F.values.joinedAt,
    });
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
      userId: ownerId,
      acknowledgedAt: F.values.acknowledgedAt,
    });
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
    const published = await first.listings.transition(listing.id, F.values.publishedListingStatus, {
      reasonCode: F.values.publishReason,
      actorType: F.values.publishActorType,
      actorUserId: ownerId,
      trigger: F.values.publishTrigger,
    });
    const report = await first.trust.submitReport(
      { listingId: published.id, reason: F.values.trustReportReason },
      ownerId,
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
      assert.deepEqual(await second.listings.findById(listing.id), published);
      assert.deepEqual(await second.inquiries.findById(inquiry.id), inquiry);
      assert.deepEqual(await second.tenancies.findById(tenancy.id), tenancy);
      assert.deepEqual(await second.participants.findById(participant.id), participant);
      assert.deepEqual(await second.terms.findById(terms.id), terms);
      assert.deepEqual(await second.acknowledgements.listByTermsId(terms.id), [acknowledgement]);
      assert.deepEqual(await second.notices.findById(notice.id), notice);
      const restartedCycle = await second.billing.findById(cycle.id);
      assert.deepEqual(restartedCycle, allocatedCycle);
      assert.equal(restartedCycle.charges[0]?.outstandingAmount, F.expected.remainingOutstanding);
      assert.deepEqual(await second.billing.findPaymentById(payment.id), payment);
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
