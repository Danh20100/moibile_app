import { loadFixture } from './fixture-loader';

export interface ListingAssetFixture {
  version: 1;
  details: {
    managementStatus: 'DRAFT'; assetType: string; publicAreaLabel: string; areaSquareMeters: string;
    advertisedDeposit: string; bedrooms: number; bathrooms: number; furnishing: string;
    amenityIds: string[]; rules: string[]; electricityOffer: string; waterOffer: string;
    serviceOffer: string; minimumTermMonths: number; availableFrom: string;
    bathroomArrangement: 'PRIVATE' | 'SHARED'; maxOccupants: number; floorLabel: string;
  };
  idempotencyConflicts: { propertyName: string; roomNameOrLabel: string; listingTitle: string };
}

export const listingAssetFixture = loadFixture<ListingAssetFixture>('rental/listing-asset-details');
