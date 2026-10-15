import assert from 'node:assert/strict';
import test from 'node:test';

import { BadRequestException } from '@nestjs/common';
import { ListingService } from '../../src/modules/listing/services/listing.service';
import { createCoreTestTransactionManager } from './support/in-memory-transaction-manager';

const location = { latitude: 10.77, longitude: 106.69 };
const draftDetails = {
  managementStatus: 'DRAFT' as const, assetType: null, publicAreaLabel: null,
  areaSquareMeters: null, advertisedDeposit: null, bedrooms: null, bathrooms: null,
  furnishing: null, amenityIds: [], rules: [], electricityOffer: null, waterOffer: null,
  serviceOffer: null, minimumTermMonths: null, availableFrom: null,
  bathroomArrangement: null, maxOccupants: null, floorLabel: null,
};

async function setup() {
  const transactions = createCoreTestTransactionManager();
  await transactions.run(async ({ repositories }) => {
    await repositories.property.createProperty({ propertyId: 'property-a', organizationId: 'org-a', name: 'Building', lifecycleStatus: 'ACTIVE', operationalAddressText: 'Private address', operationalLocation: location, publicLocationProjection: location });
    await repositories.property.createRoom({ roomId: 'room-a', propertyId: 'property-a', nameOrLabel: 'Room A', operationalState: 'VACANT', recordLifecycle: 'ACTIVE' });
    await repositories.listing.createListing({ listingId: 'listing-a', roomId: 'room-a', status: 'DRAFT', publicTitle: 'Room A', publicDescription: 'Details', publicPriceProjection: '3500000.00', publicLocationProjection: location });
  });
  return { transactions, service: new ListingService(transactions) };
}

test('Asset detail draft accepts incomplete data and round-trips every typed field', async () => {
  const { service } = await setup();
  const input = { ...draftDetails, managementStatus: 'ACTIVE' as const, assetType: 'Phòng trọ', publicAreaLabel: 'Quận 3', areaSquareMeters: '24.50', advertisedDeposit: '3000000.00', bedrooms: 1, bathrooms: 1, furnishing: 'Đầy đủ', amenityIds: ['wifi', 'private_bathroom'], rules: ['Không hút thuốc'], electricityOffer: '4,000 / kWh', waterOffer: '100,000 / người', serviceOffer: '200,000 / tháng', minimumTermMonths: 6, availableFrom: '2026-11-01', bathroomArrangement: 'PRIVATE' as const, maxOccupants: 2, floorLabel: '2' };
  await assert.rejects(service.saveAssetDetails('listing-a', { ...input, assetType: null, areaSquareMeters: null }), BadRequestException);
  const draft = await service.saveAssetDetails('listing-a', draftDetails);
  assert.deepEqual(draft, { listingId: 'listing-a', ...draftDetails });
  const active = await service.saveAssetDetails('listing-a', input);
  assert.deepEqual(active, { listingId: 'listing-a', ...input });
  assert.equal((await service.findAssetDetails('listing-a')).amenityIds[1], 'private_bathroom');
});

test('unknown amenities are rejected instead of replaced or dropped', async () => {
  const { service } = await setup();
  await assert.rejects(service.saveAssetDetails('listing-a', { ...draftDetails, amenityIds: ['unknown-label'] }), /Unknown amenity ID/);
});

test('public amenity projection exposes only the stable allowlisted IDs for published Listings', async () => {
  const { transactions, service } = await setup();
  await transactions.run(async ({ repositories }) => {
    const listing = await repositories.listing.findListing('listing-a');
    assert.ok(listing);
    await repositories.listing.updateListing({ ...listing, status: 'PUBLISHED' });
    await repositories.listing.saveAssetDetails({
      listingId: 'listing-a', ...draftDetails, managementStatus: 'ACTIVE',
      amenityIds: ['wifi', 'private_bathroom', 'legacy_unknown'],
    });
  });

  assert.deepEqual(await service.findPublicAmenityIds('listing-a'), ['wifi', 'private_bathroom']);
  await transactions.run(async ({ repositories }) => {
    const listing = await repositories.listing.findListing('listing-a');
    assert.ok(listing);
    await repositories.listing.updateListing({ ...listing, status: 'UNPUBLISHED' });
  });
  assert.deepEqual(await service.findPublicAmenityIds('listing-a'), []);
});
