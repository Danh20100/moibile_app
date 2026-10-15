import assert from 'node:assert/strict';
import test from 'node:test';
import { readRepoFiles } from '../conformance/database-v1/support/source';

test('current persisted-domain services do not own authoritative Map state', () => {
  const source = readRepoFiles([
    'src/modules/identity-access/services/identity-access.service.ts',
    'src/modules/organization/services/organization.service.ts',
    'src/modules/property/services/property.service.ts',
    'src/modules/room/services/room.service.ts',
    'src/modules/listing/services/listing.service.ts',
    'src/modules/listing/services/inquiry.service.ts',
    'src/modules/tenancy/services/tenancy.service.ts',
    'src/modules/tenancy/services/tenancy-participant.service.ts',
    'src/modules/tenancy/services/tenancy-terms.service.ts',
    'src/modules/tenancy/services/terms-acknowledgement.service.ts',
    'src/modules/tenancy/services/tenancy-notice.service.ts',
    'src/modules/billing/services/billing.service.ts',
    'src/modules/receipt/services/receipt.service.ts',
    'src/modules/incident/services/incident.service.ts',
    'src/modules/audit-trust/services/audit-trust.service.ts',
    'src/modules/onboarding/services/onboarding.service.ts',
  ]);
  assert.doesNotMatch(source, /new Map\s*</, 'CURRENT business truth must be owned by PostgreSQL repositories');
});

test('FUTURE Subscription scaffolding is isolated from current-core authority', () => {
  const currentCore = readRepoFiles([
    'src/app.module.ts',
    'src/modules/organization/organization.module.ts',
    'src/modules/property/property.module.ts',
    'src/modules/room/room.module.ts',
    'src/modules/listing/listing.module.ts',
    'src/modules/tenancy/tenancy.module.ts',
    'src/modules/billing/billing.module.ts',
    'src/modules/incident/incident.module.ts',
  ]);
  assert.doesNotMatch(currentCore, /Subscription(Module|Service)/);
});
