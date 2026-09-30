import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PersistenceCheckViolation,
  PersistenceDeadlock,
  PersistenceForeignKeyViolation,
  PersistenceSerializationFailure,
  PersistenceUnavailable,
  PersistenceUniqueViolation,
} from '../../../src/persistence/errors';
import { mapPostgresError } from '../../../src/infrastructure/database/postgres-error.mapper';
import type {
  FinanceRepository,
  IdentityRepository,
  IncidentRepository,
  ListingRepository,
  NotificationRepository,
  OrganizationRepository,
  PropertyRepository,
  TenancyRepository,
  TrustRepository,
} from '../../../src/persistence/ports';

type EveryPort =
  | IdentityRepository
  | OrganizationRepository
  | PropertyRepository
  | ListingRepository
  | TenancyRepository
  | FinanceRepository
  | IncidentRepository
  | TrustRepository
  | NotificationRepository;
const compileOnlyPortAssertion: EveryPort | undefined = undefined;
void compileOnlyPortAssertion;

test('maps PostgreSQL constraint and transaction SQLSTATE values', () => {
  const cases: Array<[string, new (...args: never[]) => Error]> = [
    ['23505', PersistenceUniqueViolation],
    ['23503', PersistenceForeignKeyViolation],
    ['23514', PersistenceCheckViolation],
    ['40P01', PersistenceDeadlock],
    ['40001', PersistenceSerializationFailure],
  ];
  for (const [code, ExpectedError] of cases) {
    const mapped = mapPostgresError({
      code,
      detail: 'secret row payload',
      query: 'SELECT secret FROM private_data',
    });
    assert.ok(mapped instanceof ExpectedError);
    assert.doesNotMatch(mapped.message, /secret|select|private_data/i);
  }
});

test('maps PostgreSQL and network connection failures to unavailable', () => {
  for (const code of ['08000', '08001', '08003', '08004', '08006', '57P01', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT']) {
    assert.ok(mapPostgresError({ code }) instanceof PersistenceUnavailable);
  }
});

test('preserves an ordinary Error and safely wraps a non-Error value', () => {
  const ordinary = new Error('ordinary application failure');
  assert.equal(mapPostgresError(ordinary), ordinary);
  const wrapped = mapPostgresError({ unexpected: 'secret payload' });
  assert.equal(wrapped.message, 'Unknown persistence failure');
});
