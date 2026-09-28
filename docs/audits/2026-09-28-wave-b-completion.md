# Wave B Completion Audit

**Branch:** `backend/core-foundations`  
**Runtime evidence SHA:** `e433aaced262e850eb597466050579842daf8d1f`  
**Authority:** Canonical v3.7 -> frozen ERD -> approved Wave B spec -> implementation plan

## Commands and results

| Command | Result |
| --- | --- |
| Focused Wave B + predecessor gate | PASS — 132/132 |
| `pnpm typecheck` | PASS |
| `python -m unittest discover -s tests/database -p "test_*.py"` | PASS — 45/45 |
| `pnpm test:conformance:erd3` | EXPECTED RED — 41/57 pass; 16 later-wave failures only |
| `pnpm test` | EXPECTED RED — 215/231 pass; 16 later-wave failures only |
| `pnpm exec tsx --test src/integrations/google-identity/google-id-token-verifier.spec.ts` | PASS — 9/9 |

## GREEN boundaries

- Authority, Identity, Organization, Property, Room, Listing, Inquiry, Tenancy, Participant, Terms, TermsAcknowledgement, TenancyNotice, and Rental Lifecycle orchestration.
- Listing and Tenancy conformance are GREEN.
- FUTURE/OPEN runtime boundary, TypeScript typecheck, and frozen database validators are GREEN.

## Expected later-wave RED

### Wave C — Finance (10)

- `current charge types are RENT ELECTRICITY WATER only`
- `Payment is a first-class actual-inflow concept belonging to exactly one Tenancy`
- `PaymentAllocation and DepositPaymentApplication are distinct first-class concepts`
- `allocation and deposit application cannot cross Tenancy`
- `allocation plus deposit application cannot exceed Payment amount`
- `confirmed Payment is corrected by void reverse plus a new Payment rather than destructive edit`
- `Receipt is evidence attached to confirmed Payment and uses ISSUED VOIDED lifecycle`
- `Receipt is not the payment record`
- `billing source of truth does not mutate paidAmount outstanding via applyPaymentOutcome`
- `deposit requirement is separated from deposit fulfillment and settlement`

### Wave D — Incident / Trust (6)

- `Incident categories match frozen ERD3 set`
- `Incident lifecycle matches frozen ERD3 states`
- `REJECTED and CLOSED are terminal`
- `RESOLVED can reopen to IN_PROGRESS`
- `IncidentEvent is a first-class append-only history concept`
- `TrustReport target is exactly Listing or Review`

## Deviations and rulings

- Restored five B3/B4 Tenancy conformance assertions that were removed from the uncommitted worktree: B4 evidence records them GREEN, so deleting frozen-contract coverage was not valid B5 progress.
- The Room HTTP operational-state route moved to `RentalLifecycleController`; stale Room-controller assertions were updated to test the new non-bypass boundary.

## OPEN issues and next boundary

- No OPEN policy was resolved. No PostgreSQL/Redis wiring, concurrency guarantee, Finance, Incident, or Trust behavior was added.
- Next dependency boundary: Wave C Finance. Database application wiring remains gated behind later reconciliation waves.
