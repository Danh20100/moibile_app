# identity-access Architecture

> Canonical v3.7 / frozen Database v1 is authoritative. Current implementation examples that conflict with it are superseded.

## Ownership

Owns digital identity normalization and access plumbing only.

Does **not** own landlord/tenant/operator business roles. A User may simultaneously browse, participate in a tenancy and operate an Organization through separate relationships.

## Public concepts

- `UserReference { userId }`
- verified principal / identity-provider mapping boundary
- authorization decisions derived from resource relationships

## Invariants

- no global `UserRole` business classification;
- authentication success does not imply Organization ownership or Tenancy participation;
- TenancyParticipant may exist without linked User;
- Organization ownership and tenancy participation are resolved by their owning contexts.

## FUTURE

Advanced team/member delegation and generalized invitations remain FUTURE unless Canonical is updated.

## Rebuild note

Existing `UserRole`, `UserProfile.role` and role-bearing invitation contracts are pre-database-v1 scaffolding and are expected to fail Database v1 conformance until rebuilt.