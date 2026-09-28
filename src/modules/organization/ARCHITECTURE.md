# organization Architecture

> Canonical v3.7 / frozen ERD3 is authoritative.

## Ownership

Organization is the rental operating workspace. The MVP physical contract includes `primary_owner_user_id`.

## Invariants

- one Organization has exactly one primary owner reference in the current MVP model;
- a User may be linked to zero or more Organizations through valid relationships;
- advanced member/team delegation is not current-core authority;
- child Property ownership is by reference; Organization does not absorb Property lifecycle.

## Rebuild note

The current service creates Organization without a primary owner and exposes a pre-ERD3 generic status lifecycle. ERD3 conformance should fail until that contract is replaced.