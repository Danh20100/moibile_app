export type OnboardingBatchStatus = 'validated' | 'confirmed';

export interface OnboardingRoomItem {
  roomNumber: string;
  basePrice: number;
  area?: number;
  maxOccupants?: number;
}

export interface OnboardingBatch {
  id: string;
  organizationId: string;
  propertyName: string;
  propertyAddress: string;
  rooms: OnboardingRoomItem[];
  status: OnboardingBatchStatus;
  createdPropertyId?: string;
  createdRoomIds?: string[];
  createdAt: string;
  updatedAt: string;
}
