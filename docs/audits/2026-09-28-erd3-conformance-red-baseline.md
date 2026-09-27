# ERD3 Conformance RED Baseline

**Status:** PROVISIONAL — source-inspected expected RED, not yet runtime-verified  
**Authority:** Canonical v3.7 → frozen ERD LV1 → LV2 → LV3 → validated PostgreSQL/PostGIS reference DDL  
**Suite:** `tests/conformance/erd3/`

## Why this is provisional

The authoring session had GitHub repository read/write access but did not have an executable checkout with project dependencies, so the required commands (`pnpm test:conformance:erd3`, `pnpm typecheck`, full `pnpm test`, database unittest discovery) were not executed here.

Therefore this document records the expected RED matrix from direct source inspection. It must not be called the runtime-frozen baseline until the verification commands run and the observed failing test names match this matrix.

A RED caused by syntax/import/path/test-harness failure is invalid and must be fixed before runtime freeze.

## Expected authority/documentation GREEN

| Test name | Frozen invariant | Expected status |
|---|---|---|
| repository reading order places Canonical v3.7 and frozen ERDs before implementation docs | Higher authority precedes project/module/code layers | EXPECTED GREEN |
| historical implementation report declares pre-ERD3 lifecycles superseded | Old implementation report is historical only | EXPECTED GREEN |
| module docs defer to frozen ERD3 authority | Module prose cannot override ERD3 | EXPECTED GREEN |
| current docs do not describe Receipt as payment truth | Payment and Receipt ownership are distinct | EXPECTED GREEN |
| FUTURE subscription and CSV Excel import are not documented as current core | FUTURE is not promoted by stale scaffolding | EXPECTED GREEN |

## Identity / Organization

| Test name | Frozen invariant | Current old contract causing RED | Owning future rebuild plan | Status |
|---|---|---|---|---|
| USER contract has no global business role | USER is digital identity; no global landlord/tenant/operator role | `UserRole` and `UserProfile.role` remain exported | Core contracts: Identity/Organization/Property/Room | EXPECTED RED |
| ORGANIZATION contract carries the primary owner reference | Organization has one primary owner reference in MVP | `OrganizationProfile` has no primary owner field | Core contracts: Identity/Organization/Property/Room | EXPECTED RED |
| old OrganizationStatus active inactive archived is not treated as ERD3 source truth | Old generic Organization lifecycle is not frozen authority | `OrganizationStatus = active | inactive | archived` remains source contract | Core contracts: Identity/Organization/Property/Room | EXPECTED RED |

## Property / Room

| Test name | Frozen invariant | Current old contract causing RED | Owning future rebuild plan | Status |
|---|---|---|---|---|
| PROPERTY lifecycle is ACTIVE ARCHIVED only | Property lifecycle is ACTIVE/ARCHIVED | Current contract already uses active/archived | Core contracts: Identity/Organization/Property/Room | EXPECTED GREEN |
| PROPERTY exposes both operational and public location concepts | Operational and public location are separate | Current Property has one address/location object only | Core contracts: Identity/Organization/Property/Room | EXPECTED RED |
| ROOM separates operational state from record lifecycle | Room has two independent dimensions | Current `RoomStatus` collapses state and archive | Core contracts: Identity/Organization/Property/Room | EXPECTED RED |
| ROOM operational states are VACANT OCCUPIED MAINTENANCE INACTIVE only | Frozen operational-state set | Current state set contains `draft`/`archived` and lacks `inactive` | Core contracts: Identity/Organization/Property/Room | EXPECTED RED |
| ROOM record lifecycle is ACTIVE ARCHIVED only | Frozen record-lifecycle set | No dedicated record-lifecycle contract | Core contracts: Identity/Organization/Property/Room | EXPECTED RED |
| ROOM contract does not own base rent price | Rent belongs to Terms; public price to Listing | Room contract/DTO still own `basePrice` | Core contracts: Identity/Organization/Property/Room | EXPECTED RED |
| old OCCUPIED to MAINTENANCE transition is not allowed | OCCUPIED→MAINTENANCE invalid | Current transition map explicitly allows it | Core contracts: Identity/Organization/Property/Room | EXPECTED RED |
| room archival is not represented as a direct operational-state transition | Archive is lifecycle workflow | Current `vacant` transition includes `archived` | Core contracts: Identity/Organization/Property/Room | EXPECTED RED |
| room archive guard requires INACTIVE and blocks nonterminal tenancy or open incident | Archive requires INACTIVE/no nonterminal tenancy/no open incident | Current Room service has no such guard/orchestration | Core contracts first; Persistence guards later | EXPECTED RED; transaction safety later |

## Listing

| Test name | Frozen invariant | Current old contract causing RED | Owning future rebuild plan | Status |
|---|---|---|---|---|
| LISTING lifecycle is DRAFT PUBLISHED UNPUBLISHED ARCHIVED only | Frozen Listing lifecycle | Current contract uses `hidden`/`rented`, lacks `unpublished`/`archived` | Listing/Tenancy lifecycle contracts | EXPECTED RED |
| LISTING no longer uses hidden or rented states | `hidden`/`rented` superseded | Old FSM/DTO still expose them | Listing/Tenancy lifecycle contracts | EXPECTED RED |
| LISTING does not duplicate Property ownership beside Room ownership | Listing references Room; Property derives through Room | Listing still stores `propertyId` beside `roomId` | Listing/Tenancy lifecycle contracts | EXPECTED RED |
| publishing is coupled to Room vacancy and active Property eligibility | Publish requires VACANT active Room under active Property | Publish path checks record existence only | Listing/Tenancy lifecycle contracts | EXPECTED RED |
| Room leaving VACANT has an explicit synchronous unpublish workflow | Leaving VACANT synchronously unpublishes current Listing | No unpublish coordination workflow | Listing/Tenancy lifecycle contracts; Persistence guards later | EXPECTED RED; transaction safety later |
| Room has at most one current non-archived Listing | Max one current Listing per Room | No single-current guard | Listing/Tenancy lifecycle contracts; Persistence guards later | EXPECTED RED; concurrency safety later |
| listing status change has a first-class event history concept | ListingStatusEvent is first-class history | No ListingStatusEvent concept | Listing/Tenancy lifecycle contracts | EXPECTED RED |

## Tenancy / Terms / Participant

| Test name | Frozen invariant | Current old contract causing RED | Owning future rebuild plan | Status |
|---|---|---|---|---|
| TENANCY lifecycle matches frozen ERD3 transitions | Includes CANCELLED; no direct ACTIVE→ENDED; ENDING may return ACTIVE | Old FSM lacks CANCELLED/reopen and allows ACTIVE→ENDED | Listing/Tenancy lifecycle contracts | EXPECTED RED |
| TENANCY does not embed tenantId as participant truth | Participation is separate from identity | TenancyProfile/DTO use direct `tenantId` | Listing/Tenancy lifecycle contracts | EXPECTED RED |
| TenancyParticipant is a first-class concept with optional USER link | Participant first-class; User link optional | No participant contract | Listing/Tenancy lifecycle contracts | EXPECTED RED |
| TenancyTerms is first-class and versioned rather than embedded mutable terms | Terms are versioned first-class facts | Terms embedded directly in TenancyProfile | Listing/Tenancy lifecycle contracts | EXPECTED RED |
| Terms acknowledgement is version-specific | Acknowledgement points to a Terms version | No TermsAcknowledgement concept | Listing/Tenancy lifecycle contracts | EXPECTED RED |
| Room has at most one non-terminal Tenancy | Max one DRAFT/ACTIVE/ENDING per Room | No guard in Tenancy creation | Listing/Tenancy contracts; Persistence guards later | EXPECTED RED; concurrency safety later |
| ENDING tenancy blocks creation of a next DRAFT tenancy for the Room | ENDING blocks next draft | No creation guard | Listing/Tenancy contracts; Persistence guards later | EXPECTED RED; concurrency safety later |
| checkout workflow couples ENDING to ENDED with Room becoming VACANT | Checkout is atomic Tenancy/Room workflow | No explicit checkout orchestration | Listing/Tenancy contracts; Persistence guards later | EXPECTED RED; transaction safety later |

## Finance

| Test name | Frozen invariant | Current old contract causing RED | Owning future rebuild plan | Status |
|---|---|---|---|---|
| current charge types are RENT ELECTRICITY WATER only | Current Charge whitelist is exact | `BillingCharge.type` is free string | Financial ledger | EXPECTED RED |
| Payment is a first-class actual-inflow concept belonging to exactly one Tenancy | Payment is actual inflow, exactly one Tenancy | No first-class Payment entity/service | Financial ledger | EXPECTED RED |
| PaymentAllocation and DepositPaymentApplication are distinct first-class concepts | Allocation/application ownership is explicit | Concepts absent | Financial ledger | EXPECTED RED |
| allocation and deposit application cannot cross Tenancy | Financial applications cannot cross Tenancy | Guard absent | Financial ledger; Persistence guards later | EXPECTED RED; transaction safety later |
| allocation plus deposit application cannot exceed Payment amount | Conservation cap on Payment amount | Aggregate cap absent | Financial ledger; Persistence guards later | EXPECTED RED; concurrency safety later |
| confirmed Payment is corrected by void reverse plus a new Payment rather than destructive edit | Confirmed Payment correction is non-destructive | Payment workflow absent; current model mutates Receipt/Billing facts | Financial ledger | EXPECTED RED |
| Receipt is evidence attached to confirmed Payment and uses ISSUED VOIDED lifecycle | Receipt belongs to confirmed Payment; ISSUED/VOIDED | Current Receipt uses `recorded/confirmed` and no Payment reference | Financial ledger | EXPECTED RED |
| Receipt is not the payment record | Receipt is evidence, not inflow truth | Receipt stores amount/payment method/tenancy/billing cycle | Financial ledger | EXPECTED RED |
| billing source of truth does not mutate paidAmount outstanding via applyPaymentOutcome | Settlement is derived from allocation facts | Current Billing owns `paidAmount`, `outstandingBalance`, `applyPaymentOutcome()` | Financial ledger | EXPECTED RED |
| deposit requirement is separated from deposit fulfillment and settlement | Terms requirement separate from Deposit fulfillment/settlement | Deposit application/settlement/event concepts absent | Financial ledger | EXPECTED RED |

## Incident

| Test name | Frozen invariant | Current old contract causing RED | Owning future rebuild plan | Status |
|---|---|---|---|---|
| Incident categories match frozen ERD3 set | Exact current category set | Category is free string / old examples include unsupported values | Incident/Trust/supporting CURRENT | EXPECTED RED |
| Incident lifecycle matches frozen ERD3 states | Frozen states include IN_PROGRESS/REJECTED and exclude old processing/need-more | Old status set remains | Incident/Trust/supporting CURRENT | EXPECTED RED |
| REJECTED and CLOSED are terminal | Both terminal | REJECTED absent | Incident/Trust/supporting CURRENT | EXPECTED RED |
| RESOLVED can reopen to IN_PROGRESS | Reopen supported | Old resolved state only closes | Incident/Trust/supporting CURRENT | EXPECTED RED |
| IncidentEvent is a first-class append-only history concept | History is append-only first-class event | IncidentEvent absent | Incident/Trust/supporting CURRENT | EXPECTED RED |

## Trust

| Test name | Frozen invariant | Current old contract causing RED | Owning future rebuild plan | Status |
|---|---|---|---|---|
| TrustReport target is exactly Listing or Review | TrustReport target set is exact | Generic targetType/targetId accepts unrelated resources | Incident/Trust/supporting CURRENT | EXPECTED RED |
| TrustReport is distinct from Incident | Incident and trust-report lifecycles are separate | Current source does not explicitly collapse them | Incident/Trust/supporting CURRENT | EXPECTED GREEN |
| trust review source does not expose a public personal landlord rating contract | No public personal landlord/user score contract | Current source has no such exported score field | Incident/Trust/supporting CURRENT | EXPECTED GREEN |

## FUTURE / OPEN boundary

| Test name | Frozen invariant | Current old contract causing RED | Owning future rebuild plan | Status |
|---|---|---|---|---|
| Subscription Pricing Quota is not registered as current core | Subscription/Pricing/Quota is FUTURE | `SubscriptionModule` is still imported by AppModule | Core surface cleanup | EXPECTED RED |
| CSV Excel import is not documented as current core | CSV/Excel import is FUTURE | Docs now classify it FUTURE; reusable manual onboarding may remain | Core surface cleanup | EXPECTED GREEN |
| OPEN policies remain explicitly unresolved rather than assigned a boolean default choice | Lower layers do not close OPEN policy | Authority/docs preserve OPEN wording; no explicit boolean policy constant asserted here | Later policy-specific work | EXPECTED GREEN |

## Required runtime verification before this baseline becomes frozen

Run from an actual repository checkout with dependencies installed:

```bash
pnpm test:conformance:erd3
pnpm typecheck
pnpm test
python -m unittest discover -s tests/database -p "test_*.py"
```

Expected gate:

```text
[GREEN] authority/documentation conformance tests
[RED by design] product-contract conformance tests listed above
[GREEN] pnpm typecheck
[RED by design] pnpm test only because conformance is included in the test glob
[GREEN] frozen database validator suite
```

After execution, replace each `EXPECTED` status with observed status and record any mismatch. Do not start the domain-core rebuild if the suite is RED for harness/syntax/import reasons or if database validation is no longer green.