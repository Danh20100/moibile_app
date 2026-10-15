import {
  PersistenceCheckViolation,
  PersistenceDeadlock,
  PersistenceForeignKeyViolation,
  PersistenceSerializationFailure,
  PersistenceUnavailable,
  PersistenceUniqueViolation,
} from '../../persistence/errors';

const unavailableCodes = new Set([
  '08000', '08001', '08003', '08004', '08006', '57P01',
  'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT',
]);

function errorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;
  return typeof error.code === 'string' ? error.code : undefined;
}

export function mapPostgresError(error: unknown): Error {
  const code = errorCode(error);
  if (code === '23505') return new PersistenceUniqueViolation();
  if (code === '23503') return new PersistenceForeignKeyViolation();
  if (code === '23514') return new PersistenceCheckViolation();
  if (code === '40P01') return new PersistenceDeadlock();
  if (code === '40001') return new PersistenceSerializationFailure();
  if (code && unavailableCodes.has(code)) return new PersistenceUnavailable();
  return error instanceof Error ? error : new Error('Unknown persistence failure');
}
