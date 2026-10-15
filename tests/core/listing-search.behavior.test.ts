import assert from 'node:assert/strict';
import test from 'node:test';

import { BadRequestException } from '@nestjs/common';

import type { ListingSearchRepository } from '../../src/persistence/ports/listing-search.repository';
import { ListingSearchService } from '../../src/modules/listing/services/listing-search.service';

test('public Listing search forwards only public projection radius and exact price filters', async () => {
  let captured: unknown[] | undefined;
  const repository: ListingSearchRepository = {
    findPublishedWithinRadius: async (...args) => {
      captured = args;
      return [
        {
          listingId: 'listing-1',
          roomId: 'room-1',
          publicTitle: 'Published Room',
          publicDescription: 'Public description',
          publicPriceProjection: '3500000.00',
          publicLocation: { latitude: 10.776, longitude: 106.7 },
          distanceMeters: 842.5,
          publicAmenityIds: ['wifi', 'private_bathroom'],
        },
      ];
    },
  };
  const service = new ListingSearchService(repository);

  const rows = await service.findPublic({
    latitude: 10.776,
    longitude: 106.7,
    radiusMeters: 5000,
    minPrice: '2000000.00',
    maxPrice: '5000000.00',
  });

  assert.deepEqual(captured, [
    { latitude: 10.776, longitude: 106.7 },
    5000,
    '2000000.00',
    '5000000.00',
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.listingId, 'listing-1');
  assert.deepEqual(rows[0]?.publicAmenityIds, ['wifi', 'private_bathroom']);
  assert.equal('operationalAddressText' in (rows[0] as object), false);
  assert.equal('operationalLocation' in (rows[0] as object), false);
});

test('public Listing search rejects invalid radius and exact min/max ordering', async () => {
  const repository: ListingSearchRepository = {
    findPublishedWithinRadius: async () => [],
  };
  const service = new ListingSearchService(repository);

  await assert.rejects(
    () => service.findPublic({ latitude: 10, longitude: 106, radiusMeters: -1 }),
    BadRequestException,
  );
  await assert.rejects(
    () =>
      service.findPublic({
        latitude: 10,
        longitude: 106,
        radiusMeters: 1000,
        minPrice: '9007199254740992.00',
        maxPrice: '9007199254740991.99',
      }),
    BadRequestException,
  );
});
