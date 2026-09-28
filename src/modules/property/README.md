# property

> Authority: `docs/database/canonical-v3.7.md` and frozen ERD3 override this module and current code.

## Purpose

`property` owns Property identity, lifecycle and location boundaries.

## Current ERD3 boundary

- lifecycle: `ACTIVE | ARCHIVED`;
- operational address/location belongs to Property;
- public location projection is distinct from operational location;
- archive is a guarded workflow, not an unrestricted status patch;
- archived Property must not permit invalid child reactivation.

## Known pre-ERD3 code drift

Current contracts expose only a single structured address object and allow direct status mutation. They do not model the separate operational/public geospatial boundary or archive guards.