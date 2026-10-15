# ERD3 Backend Reconciliation Design

**Status:** Proposed implementation design for post-ERD3 backend reconciliation  
**Date:** 2026-09-28  
**Target branch:** `backend/core-foundations`  
**Authority:** `docs/database/canonical-v3.7.md` → ERD LV1 → ERD LV2 → ERD LV3 → validated PostgreSQL/PostGIS reference DDL

## 1. Purpose

The backend currently contains a low-level architecture that predates the frozen ERD LV3 contract. Both the backend test suite and database validation suite pass independently, but they encode different domain semantics. This rework makes the backend conform to the frozen Canonical v3.7 / ERD3 authority instead of adapting ERD3 to preserve the old backend model.

The work deliberately starts with documentation authority and conformance tests before changing domain contracts. Old tests and interfaces may be removed or rewritten when they codify semantics superseded by Canonical v3.7.

## 2. Success Criteria

The reconciliation is complete when:

1. Repository reading order makes Canonical v3.7 and frozen ERD artifacts authoritative before project/module implementation docs.
2. Project-level and module-level documentation no longer contradict frozen ERD3 semantics.
3. A dedicated ERD3 conformance test suite fails against the pre-rework backend for the known mismatches and passes only after the backend is rebuilt.
4. Core domain contracts model frozen concepts without duplicating business truth.
5. CURRENT capabilities are represented; OPEN policies remain unresolved in code; FUTURE capabilities are not treated as current core requirements.
6. Runtime persistence is implemented from the frozen physical contract only after domain semantics converge.
7. Cross-row/cross-table invariants are enforced through transaction guards with concurrency-safe locking where required.
8. Existing tests that assert obsolete semantics are rewritten or removed rather than preserved artificially.

## 3. Non-Goals of the First Reconciliation Stage

The first stage does not select an ORM, create migrations, add production PostgreSQL adapters, or implement the full 29-table persistence layer.

It also does not close any Canonical `[OPEN]` policy, including Trust Report login requirements, payment unallocated handling, review policies, notification channels, or other unresolved policy items.

## 4. Authority and Documentation Model

The repository reading order becomes:

1. root `README.md`;
2. `docs/database/canonical-v3.7.md`;
3. `docs/database/erd/README.md`;
4. `docs/database/erd/trooi-erd-lv1-conceptual.json`;
5. `docs/database/erd/trooi-erd-lv2-logical.json`;
6. `docs/database/erd/trooi-erd-lv3-physical.json`;
7. `docs/PROJECT_CONTEXT.md`;
8. `docs/USE_CASES.md`;
9. `docs/SYSTEM_CONTEXT.md`;
10. target module `README.md` and `ARCHITECTURE.md`;
11. implementation.

If a lower-level document conflicts with a frozen invariant, the lower-level document is wrong and must be updated. A conflict is not resolved by preserving old implementation behavior.

`docs/SYSTEM_STRUCTURE_IMPLEMENTATION.md` becomes a historical implementation report, not current domain authority. It must explicitly state that its pre-ERD3 lifecycle descriptions are superseded by Canonical v3.7 / ERD3.

## 5. Conformance Test Strategy

Add a dedicated test area under:

```text
tests/conformance/erd3/
```

The tests are organized by frozen semantic boundary rather than by existing module names:

```text
authority.static.test.ts
identity-organization.contract.test.ts
property-room.lifecycle.test.ts
listing.contract.test.ts
tenancy.contract.test.ts
finance.contract.test.ts
incident.contract.test.ts
trust.contract.test.ts
future-open-boundary.static.test.ts
```

The initial conformance suite must intentionally fail against the old backend and pin the following frozen requirements:

- `USER` has no global landlord/tenant role.
- Organization has exactly one primary owner reference in the current MVP model.
- Property lifecycle is `ACTIVE | ARCHIVED`.
- Room has separate `operational_state` and `record_lifecycle` concepts.
- Room does not contain `DRAFT` as an operational state.
- `OCCUPIED → MAINTENANCE` and direct archive-from-vacant behavior from the old service are rejected.
- Listing lifecycle is exactly `DRAFT | PUBLISHED | UNPUBLISHED | ARCHIVED`.
- Publishing requires a VACANT active Room under an active Property.
- Leaving VACANT synchronously unpublishes the current Listing.
- Tenancy lifecycle is `DRAFT | ACTIVE | ENDING | ENDED | CANCELLED` with the frozen transition graph.
- `USER` and `TENANCY_PARTICIPANT` are distinct; participant-user linkage is optional.
- Terms are first-class and versioned; acknowledgements are version-specific.
- Billing current charge whitelist is exactly `RENT | ELECTRICITY | WATER`.
- Payment is actual inflow and belongs to exactly one Tenancy.
- Receipt belongs to Payment and uses `ISSUED | VOIDED`; it is not the Payment record.
- Payment allocation and deposit application cannot cross Tenancy.
- Payment allocation plus deposit application cannot exceed Payment amount.
- Incident lifecycle and categories match Canonical v3.7 and support `REJECTED` and reopen from `RESOLVED` to `IN_PROGRESS`.
- Incident history is append-only through IncidentEvent.
- Trust Report targets exactly one of Listing or Review.
- FUTURE capabilities such as subscription/pricing/quota gating and CSV/Excel import are not registered as current core authority.
- OPEN policies are not silently fixed by DTOs, guards, migrations, or domain defaults.

Static tests may inspect contracts/source where runtime APIs do not yet exist. Behavioral tests are preferred once the new public interfaces are introduced.

## 6. Core Domain Rebuild

### 6.1 Identity and Organization

Remove global business role from `UserProfile`. Authentication establishes digital identity only.

Organization models the rental operating workspace with a primary owner user reference. Advanced member/team delegation remains FUTURE.

### 6.2 Property and Room

Property owns property identity, lifecycle, operational address/location, and public location projection boundary.

Room is rebuilt with two independent dimensions:

```text
operational_state = VACANT | OCCUPIED | MAINTENANCE | INACTIVE
record_lifecycle = ACTIVE | ARCHIVED
```

Room no longer owns agreed rent price. Rental price belongs to Terms; public price belongs to Listing.

Archive flows are commands with guards, not unrestricted status patches.

### 6.3 Listing and Inquiry

Listing owns public discovery projection and uses the frozen lifecycle:

```text
DRAFT | PUBLISHED | UNPUBLISHED | ARCHIVED
```

`HIDDEN` and `RENTED` are removed. Status transitions append ListingStatusEvent history. Inquiry is a separate contact bridge and is not a booking or tenancy prerequisite.

### 6.4 Tenancy, Participant, Terms, Notice

Tenancy owns the rental relationship and room reference only. Tenant participation is represented through TenancyParticipant, with exactly one active PRIMARY participant for an active Tenancy and zero or more active OCCUPANT participants.

TenancyTerms is first-class and versioned. TermsAcknowledgement points to a specific version. TenancyNotice represents move-out/notice facts. Old embedded `tenantId` + mutable `terms` in `TenancyProfile` is removed.

Checkout is an atomic workflow: confirmed checkout performs `ENDING → ENDED` and Room transition to `VACANT` in one transaction boundary.

### 6.5 Finance

Financial ownership follows Canonical v3.7:

```text
BillingCycle → Charge
Payment → PaymentAllocation → Charge
Payment → DepositPaymentApplication → Deposit
Payment → Receipt
```

`Payment` is actual money inflow. `Receipt` is evidence derived from an eligible confirmed Payment. The old `ReceiptRecord` acting as payment truth and `BillingService.applyPaymentOutcome()` abstraction are removed.

`paidAmount`, `outstandingBalance`, and billing status may exist only as derived/read projections, never as a second authoritative source that can diverge from Charge/Payment allocation facts.

Deposit requirement belongs to Terms. Deposit fulfillment/holding/settlement belongs to Deposit and related application/event/settlement records.

### 6.6 Incident

Incident categories become:

```text
ELECTRICAL
PLUMBING
ACCESS_SECURITY
ROOM_FACILITY
APPLIANCE
OTHER
```

Lifecycle becomes:

```text
REPORTED → ACKNOWLEDGED | REJECTED | CLOSED
ACKNOWLEDGED → IN_PROGRESS | REJECTED
IN_PROGRESS → RESOLVED | CLOSED
RESOLVED → CLOSED | IN_PROGRESS
```

`REJECTED` and `CLOSED` are terminal. IncidentEvent is append-only history.

### 6.7 Review, Trust Report, Notification

Review eligibility follows ended Tenancy plus eligible linked participant/user. Review targets Property/rental experience, not personal landlord scoring.

TrustReport targets exactly one Listing or Review. No implementation decision is allowed for currently OPEN login/rate-limit/moderation/evidence policy.

Notification remains a side-effect capability and never owns source business state.

## 7. Bounded Context Structure

The physical 29-table model does not imply one Nest module per table. The preferred ownership structure is:

```text
identity-access
organization
property
room
listing-discovery
  ├─ Listing
  ├─ ListingStatusEvent
  └─ Inquiry
tenancy
  ├─ Tenancy
  ├─ TenancyParticipant
  ├─ TenancyTerms
  ├─ TermsAcknowledgement
  └─ TenancyNotice
finance
  ├─ BillingCycle
  ├─ Charge
  ├─ UtilityConnection
  ├─ MeterReading
  ├─ Payment
  ├─ PaymentAllocation
  ├─ PaymentClaim
  ├─ Deposit
  ├─ DepositPaymentApplication
  ├─ DepositSettlement
  ├─ DepositEvent
  └─ Receipt
incident
  ├─ Incident
  └─ IncidentEvent
trust
  ├─ Review
  └─ TrustReport
notification
read-model
```

The final folder names may preserve existing modules where doing so does not distort ownership. Business ownership is authoritative; folder compatibility is secondary.

## 8. Transaction and Concurrency Design

The frozen ERD3 transaction guards are implemented after domain contract convergence and persistence selection.

Aggregate-sensitive checks must not use unprotected `SELECT total → INSERT` patterns under ordinary READ COMMITTED. Persistence commands must lock a stable aggregate owner where concurrent write skew is possible.

Priority locking cases include:

- Payment amount cap;
- Deposit settlement amount cap;
- one non-terminal Tenancy per Room;
- Listing publish / Room vacancy coordination;
- checkout + Room state transition.

## 9. Existing Tests and Compatibility Policy

The existing 49 backend tests are not a compatibility contract when they assert superseded domain semantics.

Keep tests that protect engineering properties still valid after ERD3, such as immutable audit history, defensive copying where in-memory adapters remain, test discovery, and valid reference checks.

Rewrite or remove tests that pin obsolete behavior, including:

- Room `draft` state;
- `OCCUPIED → MAINTENANCE`;
- cycle-level `Upcoming/Due/Partial/Paid` truth when represented as authoritative mutable state;
- `applyPaymentOutcome()`;
- Receipt `recorded → confirmed` as payment truth;
- Listing `hidden/rented`;
- subscription capability behavior as current core;
- CSV/Excel onboarding assumptions as current core.

A temporary drop in old-suite pass count during the controlled contract break is expected. The merge gate is the new conformance suite plus updated valid regression tests, not preservation of obsolete assertions.

## 10. Delivery Sequence

### Stage A — Authority convergence

Update root/project/system/module documentation and mark stale implementation reports historical.

### Stage B — ERD3 conformance red suite

Add failing tests for frozen semantics and boundary exclusions before implementation changes.

### Stage C — Core lifecycle contracts

Rebuild Identity/Organization/Property/Room/Listing/Tenancy/Participant/Terms contracts and services.

### Stage D — Financial ledger

Replace the old Billing/Receipt model with Charge/Payment/Allocation/Deposit/Receipt ownership.

### Stage E — Supporting domains

Implement Inquiry, Notice, Utility, IncidentEvent, Review, TrustReport, Notification contracts.

### Stage F — Persistence baseline

Select data-access tooling only after domain convergence, then derive migrations from frozen LV3.

### Stage G — Transaction guards and concurrency

Implement and test all frozen guards.

### Stage H — Authentication/authorization hardening

Replace the scaffold Bearer-presence guard with verified principal establishment and relationship/scope authorization without closing unrelated OPEN policies.

### Stage I — Final reconciliation

Run backend regression, ERD3 conformance, database validator, schema apply/smoke/catalog parity, and security tests as one integration gate.

## 11. Explicit Decisions

- Canonical v3.7 / frozen ERD3 wins over pre-ERD3 module docs and code.
- Old backend contracts may be broken intentionally.
- No backward-compatibility adapter is required for APIs that have not shipped as a stable external contract.
- No OPEN policy is resolved implicitly.
- No FUTURE capability is promoted to current core to preserve existing scaffolding.
- PostgreSQL/PostGIS remains the target persistence platform, but ORM/migration tooling stays undecided until the domain layer converges.
