import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Module, ValidationPipe, type INestApplication } from '@nestjs/common';
import { APP_GUARD, NestFactory } from '@nestjs/core';
import { CreateBucketCommand, DeleteBucketCommand, DeleteObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { applicationRestartFixture as F } from '../../support/application-restart-fixtures';

import { API_PREFIX, applyHttpBodyParsers, AuthGuard, ResourceAuthorizationModule, TransformInterceptor } from '../../../src/common';
import { googlePrincipalUserId } from '../../../src/common/identity/deterministic-user-id';
import { DatabaseModule } from '../../../src/infrastructure/database/database.module';
import { createDatabaseClient } from '../../../src/infrastructure/database/database.client';
import { PostgresTransactionManager } from '../../../src/infrastructure/database/postgres-transaction-manager';
import { createRepositorySet } from '../../../src/infrastructure/database/repositories/repository-set';
import { TRANSACTION_MANAGER, type TransactionManager } from '../../../src/persistence/ports/transaction-manager';
import type { GoogleIdTokenVerifier } from '../../../src/integrations/google-identity';
import { GooglePrincipalResolver } from '../../../src/modules/identity-access/services/google-principal-resolver';
import { ListingModule } from '../../../src/modules/listing/listing.module';
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
import { TenancyModule } from '../../../src/modules/tenancy/tenancy.module';
import { runMigrations } from '../../../scripts/database/migrate';
import { assertSafeTestDatabaseUrl, resetPublicSchema } from './support/postgres-test-harness';
import { listingAssetFixture } from '../../support/listing-asset-fixtures';
import { rentalAssetMediaFlow } from '../../support/rental-fixtures';

function createJ04HttpModule(verifier: GoogleIdTokenVerifier) {
  @Module({
    imports: [ListingModule, TenancyModule, ResourceAuthorizationModule, DatabaseModule],
    providers: [
      {
        provide: GooglePrincipalResolver,
        inject: [TRANSACTION_MANAGER],
        useFactory: (transactions: TransactionManager) => new GooglePrincipalResolver(transactions, verifier, true, true),
      },
      { provide: APP_GUARD, useClass: AuthGuard },
    ],
  })
  class J04HttpTestModule {}
  return J04HttpTestModule;
}

async function startJ04Http(verifier: GoogleIdTokenVerifier): Promise<INestApplication> {
  const app = await NestFactory.create(createJ04HttpModule(verifier), { bodyParser: false, logger: ['error'] });
  app.setGlobalPrefix(API_PREFIX);
  applyHttpBodyParsers(app);
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
  app.useGlobalInterceptors(new TransformInterceptor());
  await app.listen(0, '127.0.0.1');
  return app;
}

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
  const storageEndpoint = process.env.LEDGER_J04_S3_ENDPOINT;
  const storageAccessKey = process.env.LEDGER_J04_S3_ACCESS_KEY;
  const storageSecretKey = process.env.LEDGER_J04_S3_SECRET_KEY;
  assert.ok(storageEndpoint, 'LEDGER_J04_S3_ENDPOINT is required');
  assert.ok(storageAccessKey, 'LEDGER_J04_S3_ACCESS_KEY is required');
  assert.ok(storageSecretKey, 'LEDGER_J04_S3_SECRET_KEY is required');
  const bucket = `trooi-j04-${randomUUID()}`;
  const previousEnvironment = new Map<string, string | undefined>([
    ['DATABASE_URL', process.env.DATABASE_URL],
    ['OBJECT_STORAGE_ENABLED', process.env.OBJECT_STORAGE_ENABLED],
    ['OBJECT_STORAGE_ENDPOINT', process.env.OBJECT_STORAGE_ENDPOINT],
    ['OBJECT_STORAGE_REGION', process.env.OBJECT_STORAGE_REGION],
    ['OBJECT_STORAGE_BUCKET', process.env.OBJECT_STORAGE_BUCKET],
    ['OBJECT_STORAGE_ACCESS_KEY', process.env.OBJECT_STORAGE_ACCESS_KEY],
    ['OBJECT_STORAGE_SECRET_KEY', process.env.OBJECT_STORAGE_SECRET_KEY],
    ['OBJECT_STORAGE_FORCE_PATH_STYLE', process.env.OBJECT_STORAGE_FORCE_PATH_STYLE],
  ]);
  Object.assign(process.env, {
    DATABASE_URL: databaseUrl,
    OBJECT_STORAGE_ENABLED: 'true',
    OBJECT_STORAGE_ENDPOINT: storageEndpoint,
    OBJECT_STORAGE_REGION: process.env.LEDGER_J04_S3_REGION || 'us-east-1',
    OBJECT_STORAGE_BUCKET: bucket,
    OBJECT_STORAGE_ACCESS_KEY: storageAccessKey,
    OBJECT_STORAGE_SECRET_KEY: storageSecretKey,
    OBJECT_STORAGE_FORCE_PATH_STYLE: 'true',
  });
  const s3 = new S3Client({
    endpoint: storageEndpoint,
    region: process.env.OBJECT_STORAGE_REGION,
    forcePathStyle: true,
    credentials: { accessKeyId: storageAccessKey, secretAccessKey: storageSecretKey },
  });
  let bucketCreated = false;
  let first: ReturnType<typeof runtime> | undefined;
  let firstClosed = false;
  let http: INestApplication | undefined;
  try {
    await s3.send(new CreateBucketCommand({ Bucket: bucket }));
    bucketCreated = true;
    await resetPublicSchema(databaseUrl);
    await runMigrations('up', databaseUrl);
    first = runtime(databaseUrl);
    const issuer = 'https://accounts.google.com';
    const subjects = new Map([
      [F.actors.ownerToken, F.actors.ownerSubject],
      [F.actors.tenantToken, F.actors.tenantSubject],
      [F.actors.outsiderToken, F.actors.outsiderSubject],
    ]);
    const ownerId = googlePrincipalUserId(issuer, F.actors.ownerSubject);
    const tenantId = googlePrincipalUserId(issuer, F.actors.tenantSubject);
    const outsiderId = googlePrincipalUserId(issuer, F.actors.outsiderSubject);
    await first.transactions.run(async ({ repositories }) => {
      await repositories.identity.ensureUser(ownerId);
      await repositories.identity.ensureUser(tenantId);
      await repositories.identity.ensureUser(outsiderId);
    });
    await first.database.insertInto('auth_identities').values([
      { auth_identity_id: randomUUID(), user_id: ownerId, provider: 'google', issuer: 'https://accounts.google.com', subject: F.actors.ownerSubject, linked_at: new Date().toISOString() },
      { auth_identity_id: randomUUID(), user_id: tenantId, provider: 'google', issuer: 'https://accounts.google.com', subject: F.actors.tenantSubject, linked_at: new Date().toISOString() },
      { auth_identity_id: randomUUID(), user_id: outsiderId, provider: 'google', issuer: 'https://accounts.google.com', subject: F.actors.outsiderSubject, linked_at: new Date().toISOString() },
    ]).execute();
    const verifier: GoogleIdTokenVerifier = {
      async verify(token) {
        const subject = subjects.get(token);
        if (!subject) throw new Error('Invalid J04 test credential');
        return { issuer, subject, email: `${subject}@example.test`, emailVerified: true };
      },
    };
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
    http = await startJ04Http(verifier);
    const apiRoot = `${await http.getUrl()}/${API_PREFIX}`;
    const request = async (token: string, path: string, init: RequestInit = {}) => {
      const currentApiRoot = `${await http!.getUrl()}/${API_PREFIX}`;
      try {
        return await fetch(`${currentApiRoot}${path}`, {
          ...init,
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init.headers },
        });
      } catch (error) {
        throw new Error(`J04 HTTP request failed: ${path}; listening=${http?.getHttpServer().listening}`, { cause: error });
      }
    };
    const mediaId = randomUUID();
    const imageBytes = readFileSync(rentalAssetMediaFlow.images[0]!.path);
    const uploaded = await request(F.actors.ownerToken, `/listings/${listing.id}/media`, {
      method: 'POST',
      body: JSON.stringify({ mediaId, contentType: 'image/jpeg', base64: imageBytes.toString('base64') }),
    });
    assert.equal(uploaded.status, 201, await uploaded.clone().text());
    const privatePhotoResponse = await request(F.actors.ownerToken, `/listings/${listing.id}/media/${mediaId}/content`);
    assert.equal(privatePhotoResponse.status, 200);
    assert.deepEqual(Buffer.from(((await privatePhotoResponse.json() as { data: { base64: string } }).data).base64, 'base64'), imageBytes);
    assert.equal((await request(F.actors.outsiderToken, `/listings/${listing.id}/media`)).status, 403);
    const publicConsent = await request(F.actors.ownerToken, `/listings/${listing.id}/media/${mediaId}/public`, {
      method: 'PATCH',
      body: JSON.stringify({ isPublic: true }),
    });
    assert.equal(publicConsent.status, 200);
    const published = await first.rentalLifecycle.publishListing(listing.id, {
      reasonCode: F.values.publishReason,
      actorType: F.values.publishActorType,
      actorUserId: ownerId,
      trigger: F.values.publishTrigger,
    });
    assert.equal(published.status, F.values.publishedListingStatus);
    const publicFeedResponse = await fetch(`${apiRoot}/listings/public`);
    assert.equal(publicFeedResponse.status, 200);
    const publicFeed = (await publicFeedResponse.json() as { data: Array<Record<string, unknown>> }).data;
    const publicListing = publicFeed.find((item) => item.id === listing.id);
    assert.deepEqual(publicListing?.publicPhotoIds, [mediaId]);
    assert.equal(JSON.stringify(publicListing).includes(F.values.operationalAddress), false);
    const publicPhoto = await fetch(`${apiRoot}/listings/public/${listing.id}/media/${mediaId}/content`);
    assert.equal(publicPhoto.status, 200);
    assert.equal(publicPhoto.headers.get('cache-control'), 'no-store');
    assert.deepEqual(Buffer.from(((await publicPhoto.json() as { data: { base64: string } }).data).base64, 'base64'), imageBytes);
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
    assert.equal((await request(F.actors.tenantToken, `/tenancies/${tenancy.id}`)).status, 200);
    assert.equal((await request(F.actors.outsiderToken, `/tenancies/${tenancy.id}`)).status, 403);
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
    const historicalTerms = {
      tenancyTermsId: '83000000-0000-4000-8000-000000000099', tenancyId: tenancy.id, version: F.values.termsVersion + 1,
      rentAmount: F.values.rentAmount, agreedDepositRequirement: F.values.depositRequirement,
      termStart: F.values.termStart, termEnd: F.values.termEnd, billingDayOrDueDateRule: [],
      electricityArrangement: 'metered', waterArrangement: ['fixed'], minimalRentalConditions: 'legacy',
      effectiveFromCycleBoundary: F.values.effectiveBoundary,
    };
    await first.transactions.run(({ repositories }) => repositories.tenancy.insertTerms(historicalTerms));
    const termsResponse = await request(F.actors.tenantToken, `/tenancies/${tenancy.id}/terms`);
    assert.equal(termsResponse.status, 200);
    const returnedTerms = (await termsResponse.json() as { data: Array<Record<string, unknown>> }).data;
    const returnedHistoricalTerms = returnedTerms.find((value) => value.id === historicalTerms.tenancyTermsId);
    assert.deepEqual(returnedHistoricalTerms && {
      billingDayOrDueDateRule: returnedHistoricalTerms.billingDayOrDueDateRule,
      electricityArrangement: returnedHistoricalTerms.electricityArrangement,
      waterArrangement: returnedHistoricalTerms.waterArrangement,
      minimalRentalConditions: returnedHistoricalTerms.minimalRentalConditions,
    }, {
      billingDayOrDueDateRule: [], electricityArrangement: 'metered', waterArrangement: ['fixed'], minimalRentalConditions: 'legacy',
    }, 'authorized HTTP Terms list preserves historical JSON shapes');
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
    assert.equal((await fetch(`${apiRoot}/listings/public/${listing.id}/media/${mediaId}/content`)).status, 404);
    await http.close();
    http = undefined;
    await first.database.destroy();
    firstClosed = true;

    const second = runtime(databaseUrl);
    try {
      http = await startJ04Http(verifier);
      const restartedApiRoot = `${await http.getUrl()}/${API_PREFIX}`;
      const restartedPhotoResponse = await request(F.actors.ownerToken, `/listings/${listing.id}/media/${mediaId}/content`);
      assert.equal(restartedPhotoResponse.status, 200);
      assert.deepEqual(Buffer.from(((await restartedPhotoResponse.json() as { data: { base64: string } }).data).base64, 'base64'), imageBytes);
      assert.equal((await request(F.actors.tenantToken, `/tenancies/${activeTenancy.id}`)).status, 200);
      assert.equal((await request(F.actors.outsiderToken, `/listings/${listing.id}/media`)).status, 403);
      assert.equal((await fetch(`${restartedApiRoot}/listings/public/${listing.id}/media/${mediaId}/content`)).status, 404);
      assert.deepEqual(await second.organizations.findById(organization.id), organization);
      assert.deepEqual(await second.properties.findById(property.id), property);
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
      if (http) {
        await http.close();
        http = undefined;
      }
      await second.database.destroy();
    }
  } finally {
    if (http) await http.close();
    if (first && !firstClosed) await first.database.destroy();
    if (bucketCreated) {
      const listed = await s3.send(new ListObjectsV2Command({ Bucket: bucket }));
      for (const object of listed.Contents ?? []) {
        if (object.Key) await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: object.Key }));
      }
      await s3.send(new DeleteBucketCommand({ Bucket: bucket }));
    }
    s3.destroy();
    for (const [key, value] of previousEnvironment) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
