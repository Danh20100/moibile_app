# identity-access

> Authority: Canonical v3.7 / frozen Database v1 override this module and current code.

## Purpose

`identity-access` establishes digital identity and authorization context. `USER` is identity only; there is no global landlord/tenant/operator business role.

Business capability comes from explicit relationships such as Organization ownership and TenancyParticipant linkage, not `UserProfile.role`.

## Current Database v1 boundary

- authenticate/normalize supported identity proofs;
- expose stable User reference;
- support relationship/resource-based authorization plumbing;
- do not own Organization, Property, Room, Tenancy or financial state;
- no global `UserRole` / invitation role-assignment surface.

## Scope notes

Advanced organization team/member delegation is FUTURE. Invitation scaffolding that assigns broad business roles must not be treated as current authority.
