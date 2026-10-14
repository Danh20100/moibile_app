import 'reflect-metadata';
import assert from 'node:assert/strict';
import { encode } from 'jpeg-js';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { Module, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { NestFactory } from '@nestjs/core';
import { CreateBucketCommand, S3Client } from '@aws-sdk/client-s3';
import {
  AuthGuard,
  applyHttpBodyParsers,
  TransformInterceptor,
  API_PREFIX,
} from '../../src/common';
import { googlePrincipalUserId } from '../../src/common/identity/deterministic-user-id';
import { DatabaseModule } from '../../src/infrastructure/database/database.module';
import { TRANSACTION_MANAGER, type TransactionManager } from '../../src/persistence/ports/transaction-manager';
import { GooglePrincipalResolver } from '../../src/modules/identity-access/services/google-principal-resolver';
import { MessagingModule } from '../../src/modules/messaging/messaging.module';
import { MessagingService } from '../../src/modules/messaging/messaging.service';
import { MessagingRepository } from '../../src/modules/messaging/messaging.repository';
import { createDatabaseClient } from '../../src/infrastructure/database/database.client';
import { PostgresOrganizationRepository } from '../../src/infrastructure/database/repositories/organization.repository';
import { PostgresPropertyRepository } from '../../src/infrastructure/database/repositories/property.repository';
import { PostgresListingRepository } from '../../src/infrastructure/database/repositories/listing.repository';
import { rentalPersistenceFixture as fixture } from '../support/rental-fixtures';
import { runMigrations } from '../../scripts/database/migrate';
import {
  OBJECT_STORAGE_PORT,
  type ObjectStoragePort,
} from '../../src/persistence/ports/object-storage.port';

const issuer = 'https://accounts.google.com';
const subjects = ['messaging-test-a', 'messaging-test-b', 'messaging-test-outsider'];
const ids = subjects.map((subject) => googlePrincipalUserId(issuer, subject));
// Only the external Google verifier is substituted. HTTP auth, PostgreSQL and S3 are real.
const testVerifier = {
  async verify(token: string) {
    if (!subjects.includes(token)) throw new Error('Invalid test credential');
    return { issuer, subject: token, emailVerified: true };
  },
};

@Module({
  imports: [MessagingModule, DatabaseModule],
  providers: [
    {
      provide: GooglePrincipalResolver,
      inject: [TRANSACTION_MANAGER],
      useFactory: (transactions: TransactionManager) => new GooglePrincipalResolver(transactions, testVerifier, true),
    },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
class MessagingTestModule {}

test('isolated HTTP two-account PostgreSQL/S3 round-trip and outsider denial', async () => {
  const url = process.env.MESSAGING_TEST_DATABASE_URL;
  assert.ok(url, 'Set MESSAGING_TEST_DATABASE_URL to the isolated compose database');
  const parsed = new URL(url);
  assert.equal(parsed.hostname, '127.0.0.1');
  assert.equal(parsed.port, '55447');
  assert.equal(parsed.pathname, '/messaging_test');
  process.env.DATABASE_URL = url;
  process.env.OBJECT_STORAGE_ENABLED = 'true';
  process.env.OBJECT_STORAGE_ENDPOINT = 'http://127.0.0.1:9047';
  process.env.OBJECT_STORAGE_REGION = 'us-east-1';
  process.env.OBJECT_STORAGE_BUCKET = `messaging-test-${randomUUID()}`;
  process.env.OBJECT_STORAGE_ACCESS_KEY = 'messaging-local';
  process.env.OBJECT_STORAGE_SECRET_KEY = 'local-messaging-test-only';
  const s3 = new S3Client({
    endpoint: process.env.OBJECT_STORAGE_ENDPOINT,
    region: 'us-east-1',
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.OBJECT_STORAGE_ACCESS_KEY,
      secretAccessKey: process.env.OBJECT_STORAGE_SECRET_KEY,
    },
  });
  await s3.send(new CreateBucketCommand({ Bucket: process.env.OBJECT_STORAGE_BUCKET }));
  await runMigrations('up', url);
  const db = createDatabaseClient({ url, maxPoolSize: 4, connectionTimeoutMs: 5000 });
  let app: Awaited<ReturnType<typeof NestFactory.create>> | undefined;
  try {
    for (let i = 0; i < ids.length; i++) {
      await db
        .insertInto('users')
        .values({ user_id: ids[i] })
        .onConflict((oc) => oc.doNothing())
        .execute();
      await db
        .insertInto('auth_identities')
        .values({
          auth_identity_id: randomUUID(),
          user_id: ids[i],
          provider: 'google',
          issuer,
          subject: subjects[i],
          linked_at: new Date().toISOString(),
        })
        .onConflict((oc) => oc.doNothing())
        .execute();
    }
    const org = randomUUID(),
      property = randomUUID(),
      room = randomUUID(),
      listing = randomUUID(),
      inquiry = randomUUID();
    await new PostgresOrganizationRepository(db).createOrganization({
      ...fixture.organization,
      organizationId: org,
      primaryOwnerUserId: ids[1],
    });
    const properties = new PostgresPropertyRepository(db);
    await properties.createProperty({
      ...fixture.property,
      propertyId: property,
      organizationId: org,
    });
    await properties.createRoom({ ...fixture.room, roomId: room, propertyId: property });
    await new PostgresListingRepository(db).createListing({
      ...fixture.listing,
      listingId: listing,
      roomId: room,
    });
    await db
      .insertInto('inquiries')
      .values({
        inquiry_id: inquiry,
        listing_id: listing,
        sender_user_id: ids[0],
        contact_intent_or_message: 'Contact',
        status: 'NEW',
        created_at: new Date().toISOString(),
      })
      .execute();
    app = await NestFactory.create(MessagingTestModule, { bodyParser: false, logger: false });
    app.setGlobalPrefix(API_PREFIX);
    applyHttpBodyParsers(app);
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
    );
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.listen(0, '127.0.0.1');
    const base = `${await app.getUrl()}/${API_PREFIX}/messaging/conversations`;
    async function request(who: number, path: string, body?: unknown) {
      const response = await fetch(base + path, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { Authorization: `Bearer ${subjects[who]}`, 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return { status: response.status, body: (await response.json()) as { data: any } };
    }
    assert.equal((await fetch(base)).status, 401);
    assert.equal(
      (await request(2, '', { contextType: 'inquiry', contextId: inquiry })).status,
      403,
    );
    const opened = await request(0, '', { contextType: 'inquiry', contextId: inquiry });
    assert.equal(opened.status, 201);
    const conversation = opened.body.data.id as string;
    assert.equal(
      (await request(1, '', { contextType: 'inquiry', contextId: inquiry })).body.data.id,
      conversation,
    );
    assert.equal(
      (await request(0, `/${conversation}/messages`, { text: 'spoof', senderUserId: ids[1] }))
        .status,
      400,
    );
    assert.equal((await request(0, '/invalid/messages')).status, 400);
    const jpeg = encode({width: 1, height: 1, data: Buffer.from([255, 0, 0, 255])}, 80).data;
    const sent = await request(0, `/${conversation}/messages`, {
      text: 'A to B',
      images: [{ contentType: 'image/jpeg', base64: jpeg.toString('base64') }],
    });
    assert.equal(sent.status, 201);
    assert.equal(sent.body.data.senderUserId, ids[0]);
    assert.equal(sent.body.data.delivery, 'server');
    const attachment = sent.body.data.attachments[0].id;
    const received = await request(1, `/${conversation}/messages/page?limit=1`);
    assert.equal(received.body.data.messages[0].text, 'A to B');
    assert.equal(received.body.data.hasMore, false);
    const image = await request(1, `/${conversation}/attachments/${attachment}`);
    assert.equal(image.status, 200);
    assert.deepEqual(Buffer.from(image.body.data.base64, 'base64'), jpeg);
    assert.equal((await request(2, `/${conversation}/attachments/${attachment}`)).status, 403);
    assert.equal((await request(2, `/${conversation}/messages`)).status, 403);
    assert.equal((await request(2, '')).body.data.length, 0);
    assert.equal((await request(2, `/${conversation}/read`, {})).status, 403);
    assert.equal((await request(2, `/${conversation}/messages`, { text: 'outsider' })).status, 403);
    const sentBack = await request(1, `/${conversation}/messages`, { text: 'B to A' });
    assert.equal(sentBack.status, 201);
    await db.updateTable('messaging_messages')
      .set({ created_at: '2026-10-14T00:00:00.000Z' })
      .where('conversation_id', '=', conversation)
      .execute();
    const latestPage = await request(0, `/${conversation}/messages/page?limit=1`);
    assert.equal(latestPage.body.data.messages[0].id, sentBack.body.data.id);
    assert.equal(latestPage.body.data.messages[0].text, 'B to A');
    assert.equal(latestPage.body.data.hasMore, true);
    assert.ok(latestPage.body.data.nextCursor);
    const olderPage = await request(0,
      `/${conversation}/messages/page?limit=1&cursor=${encodeURIComponent(latestPage.body.data.nextCursor)}`);
    assert.equal(olderPage.body.data.messages[0].id, sent.body.data.id);
    assert.equal(olderPage.body.data.messages[0].text, 'A to B');
    assert.equal(olderPage.body.data.hasMore, false);
    assert.equal(olderPage.body.data.nextCursor, null);
    assert.equal((await request(0, `/${conversation}/messages/page?limit=101`)).status, 400);
    assert.equal((await request(0, `/${conversation}/messages/page?cursor=bad`)).status, 400);
    assert.equal((await request(1, `/${conversation}/read`, {})).status, 201);
    assert.ok((await request(1, '')).body.data[0].lastReadAt);
    const stale = '2020-01-01T00:00:00.000Z';
    const newer = '2030-01-01T00:00:00.000Z';
    const messagingRepository = new MessagingRepository(db);
    await Promise.all([
      messagingRepository.advanceReadWatermark(conversation, ids[1], newer),
      messagingRepository.advanceReadWatermark(conversation, ids[1], stale),
    ]);
    const watermark = await db
      .selectFrom('messaging_participants')
      .select('last_read_at')
      .where('conversation_id', '=', conversation)
      .where('user_id', '=', ids[1])
      .executeTakeFirstOrThrow();
    assert.equal(new Date(watermark.last_read_at!).toISOString(), newer);
    const row = await db
      .selectFrom('messaging_attachments')
      .select('object_key')
      .where('attachment_id', '=', attachment)
      .executeTakeFirstOrThrow();
    assert.equal(
      (
        await fetch(
          `${process.env.OBJECT_STORAGE_ENDPOINT}/${process.env.OBJECT_STORAGE_BUCKET}/${row.object_key}`,
        )
      ).status,
      403,
    );
    // Independent database connection demonstrates durability outside the request service.
    const fresh = createDatabaseClient({ url, maxPoolSize: 1, connectionTimeoutMs: 5000 });
    try {
      assert.equal(
        (
          await new MessagingService(new MessagingRepository(fresh), {
            putObject: async () => {},
            getObject: async () => null,
          }).messages(ids[1], conversation)
        ).length,
        2,
      );
    } finally {
      await fresh.destroy();
    }
    const storage = app.get<ObjectStoragePort>(OBJECT_STORAGE_PORT);
    const attempted: string[] = [];
    const failureService = new MessagingService(new MessagingRepository(db), {
      async putObject(input) {
        attempted.push(input.key);
        if (attempted.length === 2) throw new Error('Simulated second-upload failure');
        await storage.putObject(input);
      },
      getObject: (key) => storage.getObject(key),
      deleteObject: (key) => storage.deleteObject!(key),
    });
    await assert.rejects(() =>
      failureService.post(ids[0], conversation, {
        text: 'must not persist',
        images: [1, 2].map(() => ({ contentType: 'image/jpeg', base64: jpeg.toString('base64') })),
      }),
    );
    assert.equal((await request(1, `/${conversation}/messages`)).body.data.length, 2);
    assert.equal(await storage.getObject(attempted[0]), null);
    const selfInquiry = randomUUID();
    await db
      .insertInto('inquiries')
      .values({
        inquiry_id: selfInquiry,
        listing_id: listing,
        sender_user_id: ids[1],
        contact_intent_or_message: 'Self',
        status: 'NEW',
        created_at: new Date().toISOString(),
      })
      .execute();
    assert.equal(
      (await request(1, '', { contextType: 'inquiry', contextId: selfInquiry })).status,
      422,
    );
    const unverified = randomUUID(),
      missingInquiry = randomUUID();
    await db.insertInto('users').values({ user_id: unverified }).execute();
    await db
      .insertInto('inquiries')
      .values({
        inquiry_id: missingInquiry,
        listing_id: listing,
        sender_user_id: unverified,
        contact_intent_or_message: 'Unverified',
        status: 'NEW',
        created_at: new Date().toISOString(),
      })
      .execute();
    assert.equal(
      (await request(1, '', { contextType: 'inquiry', contextId: missingInquiry })).status,
      422,
    );
    const tenancy = randomUUID();
    await db
      .insertInto('tenancies')
      .values({
        tenancy_id: tenancy,
        room_id: room,
        status: 'ENDED',
        started_at: '2026-01-01T00:00:00.000Z',
        ended_at: '2026-02-01T00:00:00.000Z',
        end_reason: 'OTHER',
      })
      .execute();
    await db
      .insertInto('tenancy_participants')
      .values({
        tenancy_participant_id: randomUUID(),
        tenancy_id: tenancy,
        user_id: ids[0],
        role: 'PRIMARY',
        joined_at: '2026-01-01T00:00:00.000Z',
        left_at: '2026-02-01T00:00:00.000Z',
      })
      .execute();
    const ended = await request(0, '', { contextType: 'tenancy', contextId: tenancy });
    assert.equal(ended.status, 201);
    assert.equal((await request(1, `/${ended.body.data.id}/messages`)).status, 200);
    assert.equal(
      (await request(2, '', { contextType: 'tenancy', contextId: tenancy })).status,
      403,
    );
    console.log(
      'CONFIRMED: A->B, B->A, PostgreSQL reload, private image retrieval, outsider/public access denied (test Google verifier)',
    );
  } finally {
    await app?.close();
    await db.destroy();
    s3.destroy();
  }
});
