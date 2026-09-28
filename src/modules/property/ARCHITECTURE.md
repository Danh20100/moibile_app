# property Architecture

> Canonical v3.7 / frozen ERD3 is authoritative.

## Ownership

Property owns identity, `ACTIVE | ARCHIVED` lifecycle, operational address/location and the public-location projection boundary.

## Invariants

- archive is a command/workflow with blockers, not a generic status patch;
- blocker booleans are an internal service seam only; HTTP clients must not supply them as authoritative truth;
- archived Property prevents invalid child reactivation;
- Room ownership is by reference; Property does not absorb Room operational state;
- operational location and public projection are intentionally separate privacy/data concerns.

## Persistence target

LV3 uses PostgreSQL/PostGIS geography fields for operational/public location. Runtime ORM/migration tooling remains undecided until domain convergence.
