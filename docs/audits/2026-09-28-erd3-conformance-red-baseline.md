# ERD3 Conformance RED Baseline

**Status:** RUNTIME-VERIFIED core freeze after H0–H6  
**Authority:** Canonical v3.7 → frozen ERD LV1 → LV2 → LV3 → validated PostgreSQL/PostGIS reference DDL  
**Suite:** `tests/conformance/erd3/`  
**Commit SHA tested (pre-H6 docs commit):** `b51d1c7` plus pending H6 doc/README phrase fixes  
**Final freeze SHA:** recorded in the H6 commit that updates this file  
**CI run / artifact:** not available in this local agent checkout; commands below were executed locally

## H6 focused core gate

```bash
pnpm exec tsx --test \
  tests/core/organization.behavior.test.ts \
  tests/core/property.behavior.test.ts \
  tests/core/room.behavior.test.ts \
  tests/conformance/erd3/identity.contract.test.ts \
  tests/conformance/erd3/organization.contract.test.ts \
  tests/conformance/erd3/property-room.lifecycle.test.ts \
  tests/conformance/erd3/future-open-boundary.static.test.ts
# PASS — 51/51

pnpm typecheck
# PASS

python -m unittest discover -s tests/database -p "test_*.py"
# PASS — 45 tests

pnpm exec tsx --test src/integrations/google-identity/google-id-token-verifier.spec.ts
# PASS — 9/9

pnpm test:conformance:erd3
# RED by design — tests=57 pass=27 fail=30

pnpm test
# RED only from the same 30 ERD3 product-contract failures — tests=137 pass=107 fail=30
```

## GREEN boundaries

| Boundary | Status | Evidence |
|---|---|---|
| Authority / documentation | **PASS** | `authority.static.test.ts` 5/5 after Canonical v3.7 phrase alignment in module READMEs |
| Identity | **PASS** | `identity.contract.test.ts` + Google verifier regression |
| Organization | **PASS** | `organization.contract.test.ts` + `tests/core/organization.behavior.test.ts` |
| Property / Room | **PASS** | `property-room.lifecycle.test.ts` + property/room behavior tests |
| FUTURE runtime boundary | **PASS** | `future-open-boundary.static.test.ts` (SubscriptionModule + OnboardingModule absent from AppModule) |
| Typecheck | **PASS** | `pnpm typecheck` |
| DB validators | **PASS** | `python -m unittest discover -s tests/database -p "test_*.py"` |

## Side-effect PASS noted

| Test name | Status | Notes |
|---|---|---|
| checkout workflow couples ENDING to ENDED with Room becoming VACANT | **PASS** (source-level) | Passes because Room service now exposes `checkout_confirmed`. Full Tenancy checkout orchestration remains Wave B ownership. |

## EXPECTED RED — Listing (Wave B)

| Test name | Status | Owner |
|---|---|---|
| LISTING lifecycle is DRAFT PUBLISHED UNPUBLISHED ARCHIVED only | EXPECTED RED | Wave B Listing/Tenancy |
| LISTING no longer uses hidden or rented states | EXPECTED RED | Wave B Listing/Tenancy |
| LISTING does not duplicate Property ownership beside Room ownership | EXPECTED RED | Wave B Listing/Tenancy |
| publishing is coupled to Room vacancy and active Property eligibility | EXPECTED RED | Wave B Listing/Tenancy |
| Room leaving VACANT has an explicit synchronous unpublish workflow | EXPECTED RED | Wave B Listing/Tenancy |
| Room has at most one current non-archived Listing | EXPECTED RED | Wave B Listing/Tenancy |
| listing status change has a first-class event history concept | EXPECTED RED | Wave B Listing/Tenancy |

## EXPECTED RED — Tenancy (Wave B)

| Test name | Status | Owner |
|---|---|---|
| TENANCY lifecycle matches frozen ERD3 transitions | EXPECTED RED | Wave B Listing/Tenancy |
| TENANCY does not embed tenantId as participant truth | EXPECTED RED | Wave B Listing/Tenancy |
| TenancyParticipant is a first-class concept with optional USER link | EXPECTED RED | Wave B Listing/Tenancy |
| TenancyTerms is first-class and versioned rather than embedded mutable terms | EXPECTED RED | Wave B Listing/Tenancy |
| Terms acknowledgement is version-specific | EXPECTED RED | Wave B Listing/Tenancy |
| Room has at most one non-terminal Tenancy | EXPECTED RED | Wave B Listing/Tenancy |
| ENDING tenancy blocks creation of a next DRAFT tenancy for the Room | EXPECTED RED | Wave B Listing/Tenancy |

## EXPECTED RED — Finance (Wave C)

| Test name | Status | Owner |
|---|---|---|
| current charge types are RENT ELECTRICITY WATER only | EXPECTED RED | Wave C Finance |
| Payment is a first-class actual-inflow concept belonging to exactly one Tenancy | EXPECTED RED | Wave C Finance |
| PaymentAllocation and DepositPaymentApplication are distinct first-class concepts | EXPECTED RED | Wave C Finance |
| allocation and deposit application cannot cross Tenancy | EXPECTED RED | Wave C Finance |
| allocation plus deposit application cannot exceed Payment amount | EXPECTED RED | Wave C Finance |
| confirmed Payment is corrected by void reverse plus a new Payment rather than destructive edit | EXPECTED RED | Wave C Finance |
| Receipt is evidence attached to confirmed Payment and uses ISSUED VOIDED lifecycle | EXPECTED RED | Wave C Finance |
| Receipt is not the payment record | EXPECTED RED | Wave C Finance |
| billing source of truth does not mutate paidAmount outstanding via applyPaymentOutcome | EXPECTED RED | Wave C Finance |
| deposit requirement is separated from deposit fulfillment and settlement | EXPECTED RED | Wave C Finance |

## EXPECTED RED — Incident (Wave D)

| Test name | Status | Owner |
|---|---|---|
| Incident categories match frozen ERD3 set | EXPECTED RED | Wave D Incident/Trust |
| Incident lifecycle matches frozen ERD3 states | EXPECTED RED | Wave D Incident/Trust |
| REJECTED and CLOSED are terminal | EXPECTED RED | Wave D Incident/Trust |
| RESOLVED can reopen to IN_PROGRESS | EXPECTED RED | Wave D Incident/Trust |
| IncidentEvent is a first-class append-only history concept | EXPECTED RED | Wave D Incident/Trust |

## EXPECTED RED — Trust (Wave D)

| Test name | Status | Owner |
|---|---|---|
| TrustReport target is exactly Listing or Review | EXPECTED RED | Wave D Incident/Trust |

## Not started

- Persistence / migrations / ORM adapters
- Concurrency / transaction guards
- Auth / resource relationship hardening (Wave E)
- Listing / Tenancy / Finance / Incident / Trust rebuilds (Waves B–D)

## H6 exit checklist

```text
[PASS] Identity independent hard gate
[PASS] no global USER business role/invitation role surface
[PASS] Google identity regression
[PASS] Organization primaryOwnerUserId semantics
[PASS] Property lifecycle/location semantics
[PASS] Room dual-state/FSM/archive/parent semantics
[PASS] FUTURE modules absent from CURRENT AppModule
[PASS] focused core tests
[PASS] focused core conformance
[PASS] pnpm typecheck
[PASS] frozen DB validators
[EXPECTED RED, NAMED] Listing/Tenancy/Finance/Incident/Trust only
[NOT STARTED] production persistence/migrations/concurrency hardening
```
