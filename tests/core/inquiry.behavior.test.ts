import assert from 'node:assert/strict';
import test from 'node:test';

import { NotFoundException } from '@nestjs/common';

import { InquiryService } from '../../src/modules/listing/services/inquiry.service';
import { ListingService } from '../../src/modules/listing/services/listing.service';
import { readRepoFile } from '../conformance/database-v1/support/source';
import { createCoreTestTransactionManager } from './support/in-memory-transaction-manager';

async function fixture() {
  const transactions = createCoreTestTransactionManager();
  const listings = new ListingService(transactions);
  const listing = await listings.createDraft({
    roomId: 'room-a',
    publicTitle: 'Room A',
    publicDescription: 'Description',
    publicPriceProjection: '1000.00',
    publicLocationProjection: { latitude: 10.77, longitude: 106.69 },
  });
  return { listings, listing, inquiries: new InquiryService(listings, transactions) };
}

test('Inquiry requires an existing Listing', async () => {
  const transactions = createCoreTestTransactionManager();
  const listings = new ListingService(transactions);
  const inquiries = new InquiryService(listings, transactions);
  await assert.rejects(
    inquiries.create({ listingId: 'missing', contactIntentOrMessage: 'Interested', status: 'new' }),
    NotFoundException,
  );
});

test('senderUserId is optional and status stays opaque text', async () => {
  const { inquiries, listing } = await fixture();
  const first = await inquiries.create({
    listingId: listing.id,
    contactIntentOrMessage: 'Call me',
    status: 'contact-open',
  });
  assert.equal(first.senderUserId, undefined);
  assert.equal(first.status, 'contact-open');

  const second = await inquiries.create({
    listingId: listing.id,
    senderUserId: 'user-a',
    contactIntentOrMessage: 'Zalo',
    status: 'another-opaque-value',
  });
  assert.equal(second.senderUserId, 'user-a');
  assert.equal(second.status, 'another-opaque-value');
});

test('multiple inquiries may exist for one Listing', async () => {
  const { inquiries, listing } = await fixture();
  await inquiries.create({ listingId: listing.id, contactIntentOrMessage: 'A', status: 'x' });
  await inquiries.create({ listingId: listing.id, contactIntentOrMessage: 'B', status: 'y' });
  assert.equal((await inquiries.findByListingId(listing.id)).length, 2);
});

test('Inquiry creation does not mutate Listing state', async () => {
  const { inquiries, listings, listing } = await fixture();
  const before = await listings.findById(listing.id);
  await inquiries.create({
    listingId: listing.id,
    contactIntentOrMessage: 'Interested',
    status: 'new',
  });
  assert.deepEqual(await listings.findById(listing.id), before);
});

test('Inquiry contract contains no booking reservation viewing or realtime thread fields', () => {
  const source = readRepoFile('src/modules/listing/contracts/index.ts');
  const declaration = source.match(/interface\s+Inquiry[\s\S]*?\n}/);
  assert.ok(declaration, 'Inquiry declaration must exist');
  assert.doesNotMatch(
    declaration[0],
    /reservation|booking|hold|viewing|appointment|thread|typing|reaction|tenancyId/i,
  );
});
