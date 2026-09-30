# tenancy

> Authority: Canonical v3.7 / frozen ERD3 override this module and current code.

## Purpose

`tenancy` owns the rental relationship and the current bounded-context concepts around participation, versioned agreed terms, acknowledgement and notice.

## Current lifecycle

`DRAFT | ACTIVE | ENDING | ENDED | CANCELLED`

Allowed transitions:

- `DRAFT → ACTIVE`
- `DRAFT → CANCELLED`
- `ACTIVE → ENDING`
- `ENDING → ACTIVE`
- `ENDING → ENDED`

Direct `ACTIVE → ENDED` is not valid.

## Ownership

- Tenancy references one Room.
- `TENANCY_PARTICIPANT` is distinct from `USER`; User linkage is optional.
- Active Tenancy has exactly one active `PRIMARY` participant and zero or more active `OCCUPANT` participants.
- `TENANCY_TERMS` is first-class and versioned.
- `TERMS_ACKNOWLEDGEMENT` points to a specific Terms version.
- `TENANCY_NOTICE` records move-out/notice facts.

## Room guards

- at most one non-terminal Tenancy (`DRAFT | ACTIVE | ENDING`) per Room;
- no next DRAFT Tenancy while current Tenancy is `ENDING`;
- confirmed checkout atomically performs `ENDING → ENDED` and Room → `VACANT`.

## Known pre-ERD3 code drift

Current code stores direct `tenantId`, embeds mutable `terms`, lacks `CANCELLED`, allows direct `ACTIVE → ENDED`, and has no participant/versioned-terms/acknowledgement/notice model.