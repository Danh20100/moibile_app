# room

> Authority: `docs/database/canonical-v3.7.md` and frozen ERD3 override this module and current code.

## Purpose

`room` owns rental-unit identity plus two independent state dimensions.

## Current ERD3 contract

```text
operational_state = VACANT | OCCUPIED | MAINTENANCE | INACTIVE
record_lifecycle = ACTIVE | ARCHIVED
```

Room does not own agreed rent price. Agreed rent belongs to TenancyTerms; public price belongs to Listing projection.

## Invariants

- no `DRAFT` operational state;
- `OCCUPIED → MAINTENANCE` is invalid;
- `OCCUPIED → INACTIVE` is invalid;
- archive requires `INACTIVE`;
- archive is blocked by a non-terminal Tenancy or open Incident;
- Room leaving `VACANT` synchronously unpublishes its current Listing;
- confirmed checkout is the workflow that returns Room to `VACANT` while ending Tenancy.

## Known pre-ERD3 code drift

Current code uses one `RoomStatus` (`draft | vacant | occupied | maintenance | archived`), stores `basePrice`, and allows direct transitions that contradict the frozen model. These contracts are scheduled to break.