import { E2E_IDS } from './ids';

export const DISCOVERY_FIXTURE = {
  ids: E2E_IDS,
  organizationName: 'TroOi E2E Organization',
  propertyName: 'TroOi E2E Property',
  operationalAddressText: 'Synthetic E2E address - not a real rental property',
  operationalLocation: { longitude: 106.75, latitude: 10.85 },
  publicLocationProjection: { longitude: 106.751, latitude: 10.851 },
  roomNameOrLabel: 'E2E Room 01',
  listing: {
    publicTitle: 'Phong E2E - Thu Duc',
    publicDescription: 'Deterministic listing fixture for full-stack E2E verification.',
    publicPriceProjection: '3500000.00',
    publishedAt: '2026-10-02T00:00:00.000Z',
  },
} as const;
