# property Architecture

> Canonical v3.7 / frozen ERD3 is authoritative.

## Ownership

Property owns identity, `ACTIVE | ARCHIVED` lifecycle, operational address/location and the public-location projection boundary.

## Invariants

- archive is a command/workflow with blockers, not a generic status patch;
- archived Property prevents invalid child reactivation;
- Room ownership is by reference; Property does not absorb Room operational state;
- operational location and public projection are intentionally separate privacy/data concerns.

## Persistence target

LV3 uses PostgreSQL/PostGIS geography fields for operational/public location. Runtime ORM/migration tooling remains undecided until domain convergence.

## Rebuild note

The current service stores one address object and directly patches status. ERD3 conformance should remain RED until the location split and guarded archive workflow exist.