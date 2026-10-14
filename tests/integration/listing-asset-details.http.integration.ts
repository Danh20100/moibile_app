import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { APP_GUARD } from '@nestjs/core';
import { NestFactory } from '@nestjs/core';
import { Module, ValidationPipe } from '@nestjs/common';
import { AuthGuard, API_PREFIX, ResourceAuthorizationModule, applyHttpBodyParsers, TransformInterceptor } from '../../src/common';
import { googlePrincipalUserId } from '../../src/common/identity/deterministic-user-id';
import { DatabaseModule } from '../../src/infrastructure/database/database.module';
import { createDatabaseClient } from '../../src/infrastructure/database/database.client';
import { PostgresTransactionManager } from '../../src/infrastructure/database/postgres-transaction-manager';
import { createRepositorySet } from '../../src/infrastructure/database/repositories/repository-set';
import { TransactionManager, TRANSACTION_MANAGER } from '../../src/persistence/ports/transaction-manager';
import { runMigrations } from '../../scripts/database/migrate';
import { resetPublicSchema } from './persistence/support/postgres-test-harness';
import { GooglePrincipalResolver } from '../../src/modules/identity-access/services/google-principal-resolver';
import { ListingModule } from '../../src/modules/listing/listing.module';
import { ListingService } from '../../src/modules/listing/services/listing.service';

const issuer = 'https://accounts.google.com';
const subjects = [randomUUID(), randomUUID()];
const userIds = subjects.map((subject) => googlePrincipalUserId(issuer, subject));
const testVerifier = { async verify(token: string) {
  const subject = subjects[Number(token.slice(-1))];
  if (!subject) throw new Error('Invalid test credential');
  return { issuer, subject, emailVerified: true };
} };

@Module({
  imports: [ListingModule, ResourceAuthorizationModule, DatabaseModule],
  providers: [
    { provide: GooglePrincipalResolver, inject: [TRANSACTION_MANAGER], useFactory: (tx: TransactionManager) => new GooglePrincipalResolver(tx, testVerifier, true) },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
class ListingDetailsTestModule {}

test('authenticated Asset details persist through HTTP, enforce owner scope and stay out of public Listing projection', async () => {
  const url = process.env.TEST_DATABASE_URL;
  assert.ok(url, 'TEST_DATABASE_URL is required');
  const parsed = new URL(url);
  assert.equal(parsed.hostname, '127.0.0.1');
  assert.equal(parsed.port, '55518');
  assert.equal(parsed.pathname, '/trooi_test');
  process.env.DATABASE_URL = url;
  await resetPublicSchema(url);
  await runMigrations('up', url);
  const database = createDatabaseClient({ url, maxPoolSize: 4, connectionTimeoutMs: 5000 });
  const transactions = new PostgresTransactionManager(database, createRepositorySet);
  const organizationId = randomUUID(), propertyId = randomUUID(), roomId = randomUUID(), listingId = randomUUID();
  await database.insertInto('users').values(userIds.map((user_id) => ({ user_id }))).execute();
  for (let index = 0; index < subjects.length; index++) {
    await database.insertInto('auth_identities').values({ auth_identity_id: randomUUID(), user_id: userIds[index]!, provider: 'google', issuer, subject: subjects[index]!, linked_at: new Date().toISOString() }).execute();
  }
  await transactions.run(async ({ repositories }) => {
    await repositories.organization.createOrganization({ organizationId, primaryOwnerUserId: userIds[0]!, name: 'Operator A' });
    await repositories.property.createProperty({ propertyId, organizationId, name: 'House A', lifecycleStatus: 'ACTIVE', operationalAddressText: 'Private exact address', operationalLocation: { latitude: 10.7777, longitude: 106.6888 }, publicLocationProjection: { latitude: 10.78, longitude: 106.69 } });
    await repositories.property.createRoom({ roomId, propertyId, nameOrLabel: 'Room 01', operationalState: 'VACANT', recordLifecycle: 'ACTIVE' });
    await repositories.listing.createListing({ listingId, roomId, status: 'DRAFT', publicTitle: 'Room 01', publicDescription: 'Public description', publicPriceProjection: '3500000.00', publicLocationProjection: { latitude: 10.78, longitude: 106.69 } });
  });
  const app = await NestFactory.create(ListingDetailsTestModule, { bodyParser: false, logger: false });
  try {
    app.setGlobalPrefix(API_PREFIX);
    applyHttpBodyParsers(app);
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.listen(0, '127.0.0.1');
    const base = `${await app.getUrl()}/${API_PREFIX}/listings/${listingId}/asset-details`;
    const request = async (account: number, method: 'GET' | 'PUT', body?: unknown) => fetch(base, {
      method, headers: { Authorization: `Bearer test-account-${account}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    assert.equal((await fetch(base)).status, 401);
    const body = {
      managementStatus: 'DRAFT', assetType: 'Phòng trọ', publicAreaLabel: 'Quận 3',
      areaSquareMeters: '24.50', advertisedDeposit: '3000000.00', bedrooms: 1, bathrooms: 1,
      furnishing: 'Đầy đủ', amenityIds: ['wifi'], rules: ['Không hút thuốc'],
      electricityOffer: '4000/kWh', waterOffer: null, serviceOffer: null, minimumTermMonths: 6,
      availableFrom: '2026-11-01', bathroomArrangement: 'PRIVATE', maxOccupants: 2, floorLabel: '2',
    };
    const saved = await request(0, 'PUT', body);
    assert.equal(saved.status, 200);
    const loaded = await request(0, 'GET');
    assert.equal(loaded.status, 200);
    assert.deepEqual((await loaded.json() as any).data, { listingId, ...body });
    assert.equal((await request(1, 'GET')).status, 403);
    assert.equal((await request(1, 'PUT', { ...body, publicAreaLabel: 'Private' })).status, 403);
    await app.get(ListingService).transition(listingId, 'published', { reasonCode: 'TEST', actorType: 'USER', actorUserId: userIds[0]!, trigger: 'COMMAND' });
    const publicResponse = await fetch(`${await app.getUrl()}/${API_PREFIX}/listings/public`);
    const publicBody = await publicResponse.json() as { data: Array<Record<string, unknown>> };
    assert.equal(publicResponse.status, 200);
    assert.deepEqual(publicBody.data[0]?.publicAmenityIds, ['wifi']);
    assert.equal('amenityIds' in (publicBody.data[0] ?? {}), false);
    assert.equal('advertisedDeposit' in (publicBody.data[0] ?? {}), false);
    assert.equal(JSON.stringify(publicBody).includes('Private exact address'), false);
  } finally {
    await app.close();
    await database.destroy();
  }
});
