# property

> Authority: Canonical v3.7 / frozen ERD3 override this module and current code.

## Purpose

`property` owns Property identity, lifecycle and location boundaries.

## Current ERD3 boundary

- lifecycle: `ACTIVE | ARCHIVED` via `lifecycleStatus`;
- operational address/location belongs to Property;
- public location projection is distinct from operational location;
- archive is a guarded service seam (`PropertyArchiveBlockers`), not an unrestricted status patch;
- archived Property must not permit invalid child reactivation.
