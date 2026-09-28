# ERD3 Conformance RED Baseline

**Status:** PARTIALLY RUNTIME-VERIFIED — Identity freeze point recorded at commit `2f144c5`  
**Authority:** Canonical v3.7 → frozen ERD LV1 → LV2 → LV3 → validated PostgreSQL/PostGIS reference DDL  
**Suite:** `tests/conformance/erd3/`  
**Commit SHA tested:** `2f144c5` (`test: split identity handoff gate from organization red baseline`)  
**CI run / artifact:** not available in this local agent checkout; commands below were executed locally

## Runtime verification commands (H1)

```bash
pnpm exec tsx --test tests/conformance/erd3/identity.contract.test.ts
# PASS — USER contract has no global business role

pnpm exec tsx --test src/integrations/google-identity/google-id-token-verifier.spec.ts
# PASS — 9/9 GoogleAuthIdTokenVerifier + factory tests

pnpm typecheck
# PASS

python -m unittest discover -s tests/database -p "test_*.py"
# PASS — 45 tests

pnpm test:conformance:erd3
# RED — tests=53 pass=9 fail=44
```

## Identity freeze

| Boundary | Command | Result | Notes |
|---|---|---|---|
| Identity conformance | `pnpm exec tsx --test tests/conformance/erd3/identity.contract.test.ts` | **PASS** | Independent hard gate after H0 split |
| Google identity regression | `pnpm exec tsx --test src/integrations/google-identity/google-id-token-verifier.spec.ts` | **PASS** | 9 tests |
| Typecheck | `pnpm typecheck` | **PASS** | |
| Frozen DB validators | `python -m unittest discover -s tests/database -p "test_*.py"` | **PASS** | 45 tests |

Identity is frozen GREEN for the focused hard gate. Remaining suite RED entries below each have a named owner.

## Observed full-suite PASS (9)

- repository reading order places Canonical v3.7 and frozen ERDs before implementation docs
- historical implementation report declares pre-ERD3 lifecycles superseded
- current docs do not describe Receipt as payment truth
- FUTURE subscription and CSV Excel import are not documented as current core *(authority.static.test.ts only)*
- OPEN policies remain explicitly unresolved rather than assigned a boolean default choice
- USER contract has no global business role
- PROPERTY lifecycle is ACTIVE ARCHIVED only
- TrustReport is distinct from Incident
- trust review source does not expose a public personal landlord rating contract

## Observed full-suite FAIL (44) with owners

### Authority / docs phrase form — owner: docs alignment before later wave freeze

| Test name | Status | Owner |
|---|---|---|
| module docs defer to frozen ERD3 authority | **RUNTIME RED** | Module README files use `canonical-v3.7.md` path form but lack exact phrase `Canonical v3.7`; ARCHITECTURE.md files already pass. Not an Identity contract defect. |

### Organization — owner: H2

| Test name | Status | Owner |
|---|---|---|
| ORGANIZATION contract carries the primary owner reference | RUNTIME RED | H2 Rebuild Organization |
| old OrganizationStatus active inactive archived is not treated as ERD3 source truth | RUNTIME RED | H2 Rebuild Organization |

### Property / Room — owner: H3 / H4

| Test name | Status | Owner |
|---|---|---|
| PROPERTY exposes both operational and public location concepts | RUNTIME RED | H3 Rebuild Property |
| ROOM separates operational state from record lifecycle | RUNTIME RED | H4 Rebuild Room |
| ROOM operational states are VACANT OCCUPIED MAINTENANCE INACTIVE only | RUNTIME RED | H4 Rebuild Room |
| ROOM record lifecycle is ACTIVE ARCHIVED only | RUNTIME RED | H4 Rebuild Room |
| ROOM contract does not own base rent price | RUNTIME RED | H4 Rebuild Room |
| old OCCUPIED to MAINTENANCE transition is not allowed | RUNTIME RED | H4 Rebuild Room |
| room archival is not represented as a direct operational-state transition | RUNTIME RED | H4 Rebuild Room |
| room archive guard requires INACTIVE and blocks nonterminal tenancy or open incident | RUNTIME RED | H4 Rebuild Room |

### FUTURE runtime boundary — owner: H5

| Test name | Status | Owner |
|---|---|---|
| Subscription Pricing Quota is not registered as current core | RUNTIME RED | H5 remove SubscriptionModule from AppModule |
| CSV Excel import is not documented as current core | RUNTIME RED | future-open-boundary regex false-positive against combined docs corpus; reconcile during H5/docs cleanup |

### Listing — owner: Wave B

| Test name | Status | Owner |
|---|---|---|
| LISTING lifecycle is DRAFT PUBLISHED UNPUBLISHED ARCHIVED only | RUNTIME RED | Wave B Listing/Tenancy |
| LISTING no longer uses hidden or rented states | RUNTIME RED | Wave B Listing/Tenancy |
| LISTING does not duplicate Property ownership beside Room ownership | RUNTIME RED | Wave B Listing/Tenancy |
| publishing is coupled to Room vacancy and active Property eligibility | RUNTIME RED | Wave B Listing/Tenancy |
| Room leaving VACANT has an explicit synchronous unpublish workflow | RUNTIME RED | Wave B Listing/Tenancy |
| Room has at most one current non-archived Listing | RUNTIME RED | Wave B Listing/Tenancy |
| listing status change has a first-class event history concept | RUNTIME RED | Wave B Listing/Tenancy |

### Tenancy — owner: Wave B

| Test name | Status | Owner |
|---|---|---|
| TENANCY lifecycle matches frozen ERD3 transitions | RUNTIME RED | Wave B Listing/Tenancy |
| TENANCY does not embed tenantId as participant truth | RUNTIME RED | Wave B Listing/Tenancy |
| TenancyParticipant is a first-class concept with optional USER link | RUNTIME RED | Wave B Listing/Tenancy |
| TenancyTerms is first-class and versioned rather than embedded mutable terms | RUNTIME RED | Wave B Listing/Tenancy |
| Terms acknowledgement is version-specific | RUNTIME RED | Wave B Listing/Tenancy |
| Room has at most one non-terminal Tenancy | RUNTIME RED | Wave B Listing/Tenancy |
| ENDING tenancy blocks creation of a next DRAFT tenancy for the Room | RUNTIME RED | Wave B Listing/Tenancy |
| checkout workflow couples ENDING to ENDED with Room becoming VACANT | RUNTIME RED | Wave B Listing/Tenancy |

### Finance — owner: Wave C

| Test name | Status | Owner |
|---|---|---|
| current charge types are RENT ELECTRICITY WATER only | RUNTIME RED | Wave C Finance |
| Payment is a first-class actual-inflow concept belonging to exactly one Tenancy | RUNTIME RED | Wave C Finance |
| PaymentAllocation and DepositPaymentApplication are distinct first-class concepts | RUNTIME RED | Wave C Finance |
| allocation and deposit application cannot cross Tenancy | RUNTIME RED | Wave C Finance |
| allocation plus deposit application cannot exceed Payment amount | RUNTIME RED | Wave C Finance |
| confirmed Payment is corrected by void reverse plus a new Payment rather than destructive edit | RUNTIME RED | Wave C Finance |
| Receipt is evidence attached to confirmed Payment and uses ISSUED VOIDED lifecycle | RUNTIME RED | Wave C Finance |
| Receipt is not the payment record | RUNTIME RED | Wave C Finance |
| billing source of truth does not mutate paidAmount outstanding via applyPaymentOutcome | RUNTIME RED | Wave C Finance |
| deposit requirement is separated from deposit fulfillment and settlement | RUNTIME RED | Wave C Finance |

### Incident — owner: Wave D

| Test name | Status | Owner |
|---|---|---|
| Incident categories match frozen ERD3 set | RUNTIME RED | Wave D Incident/Trust |
| Incident lifecycle matches frozen ERD3 states | RUNTIME RED | Wave D Incident/Trust |
| REJECTED and CLOSED are terminal | RUNTIME RED | Wave D Incident/Trust |
| RESOLVED can reopen to IN_PROGRESS | RUNTIME RED | Wave D Incident/Trust |
| IncidentEvent is a first-class append-only history concept | RUNTIME RED | Wave D Incident/Trust |

### Trust — owner: Wave D

| Test name | Status | Owner |
|---|---|---|
| TrustReport target is exactly Listing or Review | RUNTIME RED | Wave D Incident/Trust |

## Provisional vs runtime corrections

The prior source-inspected baseline incorrectly marked these as EXPECTED GREEN; runtime at `2f144c5` observed RED:

- `module docs defer to frozen ERD3 authority`
- `CSV Excel import is not documented as current core` (future-open-boundary.static.test.ts)

Authority suite test `FUTURE subscription and CSV Excel import are not documented as current core` still PASSes; the future-open-boundary CSV assertion is a separate, stricter regex over a combined corpus.

## Required gate for continuing H2+

```text
[PASS] Identity independent hard gate
[PASS] Google identity regression
[PASS] pnpm typecheck
[PASS] frozen database validator suite
[NAMED RED] Organization → H2
[NAMED RED] Property/Room → H3/H4
[NAMED RED] FUTURE AppModule registration → H5
[NAMED RED] Listing/Tenancy/Finance/Incident/Trust → later waves
[NAMED RED] module README Canonical phrase form → docs alignment
```
