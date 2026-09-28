# identity-access

> Authority: `docs/database/canonical-v3.7.md` and frozen ERD3 override this module and its current code.

## Purpose

`identity-access` establishes digital identity and authorization context. `USER` is identity only; there is no global landlord/tenant/operator business role.

Business capability comes from explicit relationships such as Organization ownership and TenancyParticipant linkage, not `UserProfile.role`.

## Current ERD3 boundary

- authenticate/normalize supported identity proofs;
- expose stable User reference;
- support relationship/resource-based authorization plumbing;
- do not own Organization, Property, Room, Tenancy or financial state.

## Scope notes

Advanced organization team/member delegation is FUTURE. Invitation scaffolding that assigns broad business roles must not be treated as current authority.

## Known pre-ERD3 code drift

Current contracts still expose `UserRole` and optional `UserProfile.role`. Those contracts are intentionally scheduled to break during the core rebuild.