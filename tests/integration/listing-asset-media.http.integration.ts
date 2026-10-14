import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Module, ValidationPipe } from '@nestjs/common';
import { APP_GUARD, NestFactory } from '@nestjs/core';
import test from 'node:test';
import { API_PREFIX, applyHttpBodyParsers, AuthGuard, ResourceAuthorizationModule, TransformInterceptor } from '../../src/common';
import { googlePrincipalUserId } from '../../src/common/identity/deterministic-user-id';
import { DatabaseModule } from '../../src/infrastructure/database/database.module';
import { createDatabaseClient } from '../../src/infrastructure/database/database.client';
import { PostgresTransactionManager } from '../../src/infrastructure/database/postgres-transaction-manager';
import { createRepositorySet } from '../../src/infrastructure/database/repositories/repository-set';
import { TRANSACTION_MANAGER, type TransactionManager } from '../../src/persistence/ports/transaction-manager';
import { runMigrations } from '../../scripts/database/migrate';
import { resetPublicSchema } from './persistence/support/postgres-test-harness';
import { GooglePrincipalResolver } from '../../src/modules/identity-access/services/google-principal-resolver';
import { ListingModule } from '../../src/modules/listing/listing.module';
import { ListingService } from '../../src/modules/listing/services/listing.service';
import { rentalPersistenceFixture, rentalAssetMediaFlow } from '../support/rental-fixtures';
import { listingAssetFixture } from '../support/listing-asset-fixtures';

const issuer = 'https://accounts.google.com';
const subjects = [randomUUID(), randomUUID()];
const users = subjects.map((subject) => googlePrincipalUserId(issuer, subject));
const verifier = { async verify(token: string) { const subject = subjects[Number(token.slice(-1))]; if (!subject) throw new Error('Invalid test credential'); return { issuer, subject, emailVerified: true }; } };
@Module({ imports: [ListingModule, ResourceAuthorizationModule, DatabaseModule], providers: [
  { provide: GooglePrincipalResolver, inject: [TRANSACTION_MANAGER], useFactory: (tx: TransactionManager) => new GooglePrincipalResolver(tx, verifier, true, true) },
  { provide: APP_GUARD, useClass: AuthGuard },
] })
class ListingAssetMediaTestModule {}

test('owner photo API stores private MinIO bytes and denies another account', { skip: process.env.LEDGER_MEDIA_MINIO_TEST !== '1' }, async () => {
  const url = process.env.TEST_DATABASE_URL;
  assert.ok(url, 'TEST_DATABASE_URL is required');
  process.env.DATABASE_URL = url;
  await resetPublicSchema(url);
  await runMigrations('up', url);
  const db = createDatabaseClient({ url, maxPoolSize: 4, connectionTimeoutMs: 5000 });
  const tx = new PostgresTransactionManager(db, createRepositorySet);
  const { ids, organization, property, room, listing } = rentalPersistenceFixture;
  const organizationId = ids.org, propertyId = ids.property, roomId = ids.room, listingId = ids.listing, mediaId = randomUUID();
  const bytes = readFileSync(rentalAssetMediaFlow.images[0]!.path);
  await db.insertInto('users').values(users.map((user_id) => ({ user_id }))).execute();
  for (let i = 0; i < subjects.length; i++) await db.insertInto('auth_identities').values({ auth_identity_id: randomUUID(), user_id: users[i]!, provider: 'google', issuer, subject: subjects[i]!, linked_at: new Date().toISOString() }).execute();
  await tx.run(async ({ repositories }) => {
    await repositories.organization.createOrganization({ ...organization, organizationId, primaryOwnerUserId: users[0]! });
    await repositories.property.createProperty({ ...property, propertyId, organizationId });
    await repositories.property.createRoom({ ...room, roomId, propertyId });
    await repositories.listing.createListing({ ...listing, listingId, roomId });
  });
  const app = await NestFactory.create(ListingAssetMediaTestModule, { bodyParser: false, logger: false });
  try {
    app.setGlobalPrefix(API_PREFIX); applyHttpBodyParsers(app);
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.listen(0, '127.0.0.1');
    const root = `${await app.getUrl()}/${API_PREFIX}/listings/${listingId}/media`;
    const request = (account: number, path = '', init: RequestInit = {}) => fetch(`${root}${path}`, { ...init, headers: { Authorization: `Bearer test-account-${account}`, 'Content-Type': 'application/json', ...init.headers } });
    assert.equal((await request(0)).status, 200);
    const upload = await request(0, '', { method: 'POST', body: JSON.stringify({ mediaId, contentType: rentalAssetMediaFlow.images[0]!.contentType, base64: bytes.toString('base64') }) });
    assert.equal(upload.status, 201);
    assert.equal((await upload.clone().json() as any).data.isPublic, false);
    assert.equal((await request(0, `/${mediaId}/content`)).status, 200);
    const privateRead = await request(1);
    assert.equal(privateRead.status, 403);
    assert.equal((await request(1, `/${mediaId}/content`)).status, 403);
    assert.equal((await request(1, `/${mediaId}/public`, { method: 'PATCH', body: JSON.stringify({ isPublic: true }) })).status, 403);
    const imageResponse = await request(0, `/${mediaId}/content`);
    const image = (await imageResponse.json() as any).data;
    assert.equal(image.contentType, 'image/jpeg');
    assert.deepEqual(Buffer.from(image.base64, 'base64'), bytes);
    const publicPath = `/listings/public/${listingId}/media/${mediaId}/content`;
    assert.equal((await fetch(`${await app.getUrl()}/${API_PREFIX}${publicPath}`)).status, 404);
    const approved = await request(0, `/${mediaId}/public`, { method: 'PATCH', body: JSON.stringify({ isPublic: true }) });
    assert.equal(approved.status, 200);
    assert.equal((await approved.json() as any).data.isPublic, true);
    await app.get(ListingService).saveAssetDetails(listingId, {
      ...listingAssetFixture.details,
      managementStatus: 'ACTIVE',
    });
    await app.get(ListingService).transition(listingId, 'published', { reasonCode: 'TEST', actorType: 'USER', actorUserId: users[0]!, trigger: 'COMMAND' });
    const publicListings = await fetch(`${await app.getUrl()}/${API_PREFIX}/listings/public`);
    const listing = ((await publicListings.json() as any).data as any[]).find((value) => value.id === listingId);
    assert.deepEqual(listing.publicPhotoIds, [mediaId]);
    const publicImageResponse = await fetch(`${await app.getUrl()}/${API_PREFIX}${publicPath}`);
    assert.equal(publicImageResponse.status, 200);
    assert.equal(publicImageResponse.headers.get('cache-control'), 'no-store');
    assert.deepEqual(Buffer.from(((await publicImageResponse.json() as any).data).base64, 'base64'), bytes);
    await app.get(ListingService).transition(listingId, 'unpublished', { reasonCode: 'TEST', actorType: 'USER', actorUserId: users[0]!, trigger: 'COMMAND' });
    assert.equal((await fetch(`${await app.getUrl()}/${API_PREFIX}${publicPath}`)).status, 404);
    assert.equal((await request(0, `/${mediaId}`, { method: 'DELETE' })).status, 200);
    assert.deepEqual((await (await request(0)).json() as any).data, []);
  } finally { await app.close(); await db.destroy(); }
});
