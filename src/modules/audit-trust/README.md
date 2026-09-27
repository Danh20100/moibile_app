# audit-trust

> Authority: `docs/database/canonical-v3.7.md` and frozen ERD3 override this module and current code.

## Purpose

This pre-ERD3 module currently mixes generic audit history and internal reports. Under ERD3, trust/report semantics must align with explicit Review and TrustReport concepts without taking ownership of source-domain lifecycles.

## Current ERD3 trust boundary

- `REVIEW` represents eligible rental-experience review facts.
- `TRUST_REPORT` targets exactly one `LISTING` or `REVIEW`.
- TrustReport is distinct from Incident.
- no public personal landlord/user scoring contract is implied.

## OPEN policy discipline

Login requirement, rate limiting, moderation/evidence handling and other Canonical `[OPEN]` policies remain unresolved. This module must not silently decide them through guards/defaults.

## Known pre-ERD3 code drift

Current report DTO accepts arbitrary target types such as user/property/receipt. That target model is superseded and scheduled to break.