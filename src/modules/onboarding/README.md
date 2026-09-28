# onboarding

> Authority: `docs/database/canonical-v3.7.md` and frozen ERD3 override this module and current code.

## Current scope

Manual orchestration that helps create CURRENT Organization/Property/Room data may remain as an application workflow when it does not own the resulting domain state.

## FUTURE boundary

CSV/Excel import, bulk-import product scope and import-specific parsing/templates are **FUTURE** under Canonical v3.7.

The existence of pre-ERD3 preview/confirm scaffolding does not promote CSV/Excel import into current core.

## Ownership rule

After current domain data is created, ownership belongs to the destination contexts. Onboarding is never the long-term source of truth for Property or Room.

## Known pre-ERD3 code drift

Current docs/code were designed around bulk setup. Reconciliation must preserve only reusable manual orchestration and keep import-specific capability outside CURRENT authority.