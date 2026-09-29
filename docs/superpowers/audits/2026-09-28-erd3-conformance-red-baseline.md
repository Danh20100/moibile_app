# Core Foundation Runtime Freeze — Domain Contract Baseline

> Legacy filename retained intentionally (`erd3` naming normalization is deferred).

**Status:** RUNTIME-VERIFIED Core Foundation freeze after Core Foundation Hardening F0–F5  
**Authority:** Canonical v3.7 → ERD LV1 → LV2 → LV3 → validated PostgreSQL/PostGIS reference DDL (supporting representations)  
**Domain Contract suite (legacy path):** `tests/conformance/erd3/`  
**Expected downstream failure baseline:** `tests/conformance/erd3/expected-failures.json` (30 entries, exact-set)  
**Commit SHA tested:** `2fe64ffb126595017cd88bba2b30dd5f8527098d`  
**GitHub Actions run:** `36446469729` — https://github.com/onsra520/TroOi-Project/actions/runs/36446469729 — conclusion `success`  
**Artifact:** `core-foundation-runtime-evidence-2fe64ffb126595017cd88bba2b30dd5f8527098d` (ID `10979729133`) containing `domain-contract.junit.xml`, `full-test.junit.xml`

This commit (documentation only) is itself verified by the workflow run of the resulting branch HEAD; that final SHA/run is recorded in the hardening handoff completion report because a document cannot contain its own commit SHA.

## Hardening commits

| Packet | Commit | Summary |
|---|---|---|
| F0 | `4210ebe` | JUnit exact-set classifier `scripts/verify-test-baseline.mjs` + committed baseline |
| F1 | `aef02ed` | Independent Core Foundation CI hard gates; grep heuristics removed |
| F2 | `09c9c3d` | `PropertyService` requires `OrganizationService`; `RoomService` requires `PropertyService` |
| F3 | `2fe64ff` | Supplied empty update strings rejected; DTO validation added to hard gate |

## Verification sequence (CI run 36446469729)

```bash
pnpm typecheck
# PASS

pnpm test:core-foundation
# PASS — tests=67 pass=67 fail=0

python -m unittest discover -s tests/database -p 'test_*.py'
# PASS — Ran 45 tests, OK

pnpm exec tsx --test src/integrations/google-identity/google-id-token-verifier.spec.ts
# PASS — tests=9 pass=9 fail=0

pnpm test:domain-contract:junit            # raw exit 1 (expected downstream failures)
node scripts/verify-test-baseline.mjs --junit domain-contract.junit.xml \
  --baseline tests/conformance/erd3/expected-failures.json --suite domain-contract --exit-code 1
# PASS — tests=57 pass=27 fail=30; matched expected failures 30/30; unexpected 0; missing 0

pnpm test:full:junit                       # raw exit 1 (same downstream failures)
node scripts/verify-test-baseline.mjs --junit full-test.junit.xml \
  --baseline tests/conformance/erd3/expected-failures.json --suite full-repository --exit-code 1
# PASS — tests=172 pass=142 fail=30; matched expected failures 30/30; unexpected 0; missing 0
```

`pnpm test:core-foundation` covers: Organization/Property/Room behavior, Identity domain contract, Organization domain contract, Property/Room lifecycle contract, CURRENT/FUTURE runtime boundary, and DTO boundary validation.

Classification is fail-closed: an unexpected failure, a missing expected failure, malformed/missing JUnit, inconsistent JUnit totals, a nonzero exit without failing testcases, or a fully green suite against a non-empty baseline all fail CI. When a later wave makes an expected failure pass, it must remove that entry from the baseline in the same change.

## GREEN boundaries (zero accepted failures)

| Boundary | Status | Evidence |
|---|---|---|
| Identity | **PASS** | `identity.contract.test.ts` + Google verifier regression 9/9 |
| Organization | **PASS** | `organization.contract.test.ts` + `tests/core/organization.behavior.test.ts` |
| Property / Room | **PASS** | `property-room.lifecycle.test.ts` + property/room behavior tests with required parent chain |
| CURRENT/FUTURE runtime boundary | **PASS** | `future-open-boundary.static.test.ts` |
| DTO boundary | **PASS** | `tests/core/dto-boundary.validation.test.ts` |
| Typecheck | **PASS** | `pnpm typecheck` |
| DB validators | **PASS** | 45 tests |

## Side-effect PASS noted

| Test name | Status | Notes |
|---|---|---|
| checkout workflow couples ENDING to ENDED with Room becoming VACANT | **PASS** (source-level) | Passes because Room service exposes `checkout_confirmed`. Full Tenancy checkout orchestration remains Wave B ownership. |

## Expected downstream failures — Listing (Wave B)

| Test name | Owner |
|---|---|
| LISTING lifecycle is DRAFT PUBLISHED UNPUBLISHED ARCHIVED only | Wave B Listing/Tenancy |
| LISTING no longer uses hidden or rented states | Wave B Listing/Tenancy |
| LISTING does not duplicate Property ownership beside Room ownership | Wave B Listing/Tenancy |
| publishing is coupled to Room vacancy and active Property eligibility | Wave B Listing/Tenancy |
| Room leaving VACANT has an explicit synchronous unpublish workflow | Wave B Listing/Tenancy |
| Room has at most one current non-archived Listing | Wave B Listing/Tenancy |
| listing status change has a first-class event history concept | Wave B Listing/Tenancy |

## Expected downstream failures — Tenancy (Wave B)

| Test name | Owner |
|---|---|
| TENANCY lifecycle matches frozen ERD3 transitions | Wave B Listing/Tenancy |
| TENANCY does not embed tenantId as participant truth | Wave B Listing/Tenancy |
| TenancyParticipant is a first-class concept with optional USER link | Wave B Listing/Tenancy |
| TenancyTerms is first-class and versioned rather than embedded mutable terms | Wave B Listing/Tenancy |
| Terms acknowledgement is version-specific | Wave B Listing/Tenancy |
| Room has at most one non-terminal Tenancy | Wave B Listing/Tenancy |
| ENDING tenancy blocks creation of a next DRAFT tenancy for the Room | Wave B Listing/Tenancy |

## Expected downstream failures — Finance (Wave C)

| Test name | Owner |
|---|---|
| current charge types are RENT ELECTRICITY WATER only | Wave C Finance |
| Payment is a first-class actual-inflow concept belonging to exactly one Tenancy | Wave C Finance |
| PaymentAllocation and DepositPaymentApplication are distinct first-class concepts | Wave C Finance |
| allocation and deposit application cannot cross Tenancy | Wave C Finance |
| allocation plus deposit application cannot exceed Payment amount | Wave C Finance |
| confirmed Payment is corrected by void reverse plus a new Payment rather than destructive edit | Wave C Finance |
| Receipt is evidence attached to confirmed Payment and uses ISSUED VOIDED lifecycle | Wave C Finance |
| Receipt is not the payment record | Wave C Finance |
| billing source of truth does not mutate paidAmount outstanding via applyPaymentOutcome | Wave C Finance |
| deposit requirement is separated from deposit fulfillment and settlement | Wave C Finance |

## Expected downstream failures — Incident (Wave D)

| Test name | Owner |
|---|---|
| Incident categories match frozen ERD3 set | Wave D Incident/Trust |
| Incident lifecycle matches frozen ERD3 states | Wave D Incident/Trust |
| REJECTED and CLOSED are terminal | Wave D Incident/Trust |
| RESOLVED can reopen to IN_PROGRESS | Wave D Incident/Trust |
| IncidentEvent is a first-class append-only history concept | Wave D Incident/Trust |

## Expected downstream failures — Trust (Wave D)

| Test name | Owner |
|---|---|
| TrustReport target is exactly Listing or Review | Wave D Incident/Trust |

## Not started

- Persistence Layer / Schema Migration / ORM adapters
- Concurrency / transaction guards
- Auth / resource relationship hardening (Wave E)
- Listing / Tenancy / Finance / Incident / Trust rebuilds (Waves B–D)

## Exit checklist

```text
[PASS] classifier tests prove exact-set equality and fail-closed behavior
[PASS] expected-failure baseline contains only named downstream domain gaps (30)
[PASS] complete Core Foundation focused suite is a hard CI gate
[PASS] PropertyService requires OrganizationService
[PASS] RoomService requires PropertyService
[PASS] direct service tests cannot bypass parent reference integrity
[PASS] supplied empty update strings are rejected
[PASS] pnpm typecheck
[PASS] frozen database validators (45)
[PASS] Google identity regression (9/9)
[PASS] domain-contract exact baseline classification (30/30)
[PASS] full-repository exact baseline classification (30/30)
[PASS] GitHub Actions overall conclusion = success (run 36446469729)
[NOT STARTED] Persistence Layer / Schema Migration / concurrency hardening
```
