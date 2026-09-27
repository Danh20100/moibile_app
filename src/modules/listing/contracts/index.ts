export type ListingStatus = 'draft' | 'published' | 'hidden' | 'rented';

export interface ListingReference {
  listingId: string;
}

export interface ListingContent {
  id: string;
  roomId: string;
  propertyId: string;
  title: string;
  description: string;
  price: number;
  locationSummary: string;
  status: ListingStatus;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}
