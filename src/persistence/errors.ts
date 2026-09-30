export class PersistenceUniqueViolation extends Error {
  constructor() { super('Persistence unique constraint violated'); this.name = PersistenceUniqueViolation.name; }
}
export class PersistenceForeignKeyViolation extends Error {
  constructor() { super('Persistence foreign key constraint violated'); this.name = PersistenceForeignKeyViolation.name; }
}
export class PersistenceCheckViolation extends Error {
  constructor() { super('Persistence check constraint violated'); this.name = PersistenceCheckViolation.name; }
}
export class PersistenceDeadlock extends Error {
  constructor() { super('Persistence transaction deadlocked'); this.name = PersistenceDeadlock.name; }
}
export class PersistenceSerializationFailure extends Error {
  constructor() { super('Persistence transaction serialization failed'); this.name = PersistenceSerializationFailure.name; }
}
export class PersistenceUnavailable extends Error {
  constructor() { super('Persistence service unavailable'); this.name = PersistenceUnavailable.name; }
}
