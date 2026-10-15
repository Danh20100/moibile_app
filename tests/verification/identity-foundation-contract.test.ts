import assert from 'node:assert/strict';
import test from 'node:test';
import { readRepoFiles } from '../conformance/database-v1/support/source';

test('physical-backed core contracts expose no non-persisted profile fields or prefixed random IDs', () => {
  const contracts = readRepoFiles([
    'src/modules/identity-access/contracts/index.ts',
    'src/modules/organization/contracts/index.ts',
    'src/modules/property/contracts/index.ts',
    'src/modules/room/contracts/index.ts',
  ]);
  assert.doesNotMatch(contracts, /externalSubject|createdAt|updatedAt/);

  const services = readRepoFiles([
    'src/modules/identity-access/services/identity-access.service.ts',
    'src/modules/organization/services/organization.service.ts',
    'src/modules/property/services/property.service.ts',
    'src/modules/room/services/room.service.ts',
    'src/modules/listing/services/listing.service.ts',
    'src/modules/listing/services/inquiry.service.ts',
    'src/modules/tenancy/services/tenancy.service.ts',
    'src/modules/billing/services/billing.service.ts',
    'src/modules/receipt/services/receipt.service.ts',
    'src/modules/incident/services/incident.service.ts',
    'src/modules/audit-trust/services/audit-trust.service.ts',
  ]);
  assert.doesNotMatch(
    services,
    /Date\.now\(\)[\s\S]{0,80}Math\.random|`(?:user|org|prop|room|list|ten|bill|rcpt|inc|rep)_/,
  );
});
