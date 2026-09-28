# System Context

Status: Current bounded-context map below Canonical v3.7 / frozen ERD3 authority.

## 1. Authority and conflict resolution

Canonical v3.7 and the frozen ERD chain are authoritative for ownership, lifecycle, invariants and CURRENT/OPEN/FUTURE classification. Module documentation and implementation are subordinate.

If a lower-level artifact conflicts with a frozen invariant, the lower-level artifact changes. Do not preserve pre-ERD3 behavior by weakening the frozen model.

## 2. System mental model

The backend is organized by business ownership, not by a single linear `Organization → Property → Room → Tenancy → Billing → Receipt` chain.

The current model distinguishes:

- identity (`USER`);
- operating workspace (`ORGANIZATION`);
- property and rental-unit state (`PROPERTY`, `ROOM`);
- discovery (`LISTING`, `LISTING_STATUS_EVENT`, `INQUIRY`);
- rental relationship (`TENANCY`, `TENANCY_PARTICIPANT`, `TENANCY_TERMS`, `TERMS_ACKNOWLEDGEMENT`, `TENANCY_NOTICE`);
- receivables and utilities (`BILLING_CYCLE`, `CHARGE`, `UTILITY_CONNECTION`, `METER_READING`);
- actual money inflow and allocation (`PAYMENT`, `PAYMENT_ALLOCATION`, `PAYMENT_CLAIM`);
- deposit fulfillment and settlement (`DEPOSIT`, `DEPOSIT_PAYMENT_APPLICATION`, `DEPOSIT_SETTLEMENT`, `DEPOSIT_EVENT`);
- receipt evidence (`RECEIPT`);
- problem lifecycle/history (`INCIDENT`, `INCIDENT_EVENT`);
- review/trust (`REVIEW`, `TRUST_REPORT`);
- side effects/read surfaces (`NOTIFICATION`, dashboard/read models).

A physical table does not imply one Nest module per table. The bounded contexts below are ownership groupings.

## 3. Preferred bounded-context ownership

### `identity-access`
Owns digital identity/authentication boundary and authorization plumbing. A User has no global landlord/tenant/operator role.

### `organization`
Owns the rental operating workspace and primary-owner relationship. Advanced team/delegation is FUTURE.

### `property`
Owns Property identity, `ACTIVE | ARCHIVED` lifecycle and operational/public location boundary.

### `room`
Owns Room identity plus independent `operational_state` and `record_lifecycle`. Room does not own agreed rent price.

### `listing-discovery`
Owns Listing, ListingStatusEvent and Inquiry. Listing lifecycle is `DRAFT | PUBLISHED | UNPUBLISHED | ARCHIVED`. Publish eligibility depends on Room vacancy and active Property state; a Room leaving VACANT synchronously unpublishes the current Listing.

### `tenancy`
Owns Tenancy, TenancyParticipant, TenancyTerms, TermsAcknowledgement and TenancyNotice. User identity and tenancy participation are distinct. Terms are versioned and acknowledgement is version-specific.

### `finance`
Owns BillingCycle, Charge, UtilityConnection, MeterReading, Payment, PaymentAllocation, PaymentClaim, Deposit, DepositPaymentApplication, DepositSettlement, DepositEvent and Receipt.

Important financial ownership:

```text
BillingCycle → Charge
Payment → PaymentAllocation → Charge
Payment → DepositPaymentApplication → Deposit
Payment → Receipt
```

Payment is actual money inflow. Receipt is evidence from an eligible confirmed Payment, not the Payment record. Mutable cycle-level `paidAmount` / `outstandingBalance` may exist only as derived/read projections.

### `incident`
Owns Incident and append-only IncidentEvent history. Current categories are `ELECTRICAL | PLUMBING | ACCESS_SECURITY | ROOM_FACILITY | APPLIANCE | OTHER`.

### `trust`
Owns Review and TrustReport semantics. TrustReport targets Listing or Review; it is separate from Incident.

### `notification`
Owns delivery/side-effect behavior only, never source business state.

### `read-model`
Owns denormalized query surfaces such as operational dashboard/search projections, never write authority for source domains.

## 4. Cross-context invariants

The most important cross-context rules include:

- no global USER business role;
- Property archive blocks child reactivation;
- Room operational state and record lifecycle remain separate;
- Room archive requires `INACTIVE`, no non-terminal Tenancy and no open Incident;
- `OCCUPIED → INACTIVE` and `OCCUPIED → MAINTENANCE` are invalid;
- Listing publish requires VACANT active Room under active Property;
- Room leaving `VACANT` synchronously unpublishes the current Listing;
- at most one current/non-archived Listing per Room;
- at most one non-terminal Tenancy (`DRAFT | ACTIVE | ENDING`) per Room;
- no next DRAFT Tenancy while the current Tenancy is ENDING;
- checkout is the workflow that atomically performs `ENDING → ENDED` and Room → `VACANT`;
- active Tenancy has exactly one active PRIMARY participant and zero or more active OCCUPANT participants;
- payment allocation and deposit application may not cross Tenancy;
- allocation + deposit application amount may not exceed Payment amount;
- only confirmed Payment counts as received money;
- confirmed Payment correction is non-destructive (void/reverse + new Payment);
- Receipt is issued only from confirmed Payment;
- IncidentEvent is append-only.

Cross-row rules that can race under concurrent requests require transaction-safe persistence guards and locking; application-level pre-checks are not sufficient.

## 5. Current use-case ownership

| Use case | Primary ownership |
|---|---|
| Authenticate | `identity-access` |
| Set up Organization/Property/Room | distributed across those owners |
| Publish/discover a Room | `listing-discovery` with Property/Room eligibility |
| Start/manage a Tenancy | `tenancy` with Room guard |
| Record agreed Terms | `tenancy` |
| Create receivable obligations | `finance` (`BillingCycle`/`Charge`) |
| Record actual payment | `finance` (`Payment`) |
| Allocate payment | `finance` (`PaymentAllocation`) |
| Handle deposit | `finance` (`Deposit*`) |
| Issue receipt evidence | `finance` (`Receipt`) |
| Report/resolve incident | `incident` |
| Review / report trust issue | `trust` |
| Dashboard | `read-model` |
| Notify user | `notification` side effect |

## 6. State coupling versus independence

Contexts remain independent unless Canonical defines a coupling invariant. Examples of required coupling include Room-vacancy/Listing unpublish and checkout/Tenancy/Room state. Examples that remain independent include billing arrears not directly mutating Room state and notification delivery not mutating the source fact.

## 7. Persistence boundary

PostgreSQL/PostGIS is the target physical platform. The validated LV3 schema is a reference contract, not yet the runtime migration baseline. ORM/migration tooling remains undecided until domain contracts converge.

Runtime persistence must enforce frozen transaction guards. For aggregate-sensitive checks, lock a stable aggregate owner where needed, especially for:

- Payment amount cap;
- Deposit settlement cap;
- one non-terminal Tenancy per Room;
- Listing publish / Room vacancy coordination;
- checkout + Room state transition.

## 8. CURRENT / OPEN / FUTURE discipline

CURRENT capabilities are part of the frozen present model even if implementation is incomplete.

`[OPEN]` policies remain unresolved. Lower layers must not silently turn an OPEN question into a default.

FUTURE includes Subscription/Pricing/Quota, CSV/Excel import, advanced team/delegation, extra charge types, partner marketplace, AI/OCR, messaging, saved search, OTA integration, proration and public ratings.

Pre-ERD3 Subscription or bulk-import scaffolding is not current domain authority.

## 9. Reading flow

1. `docs/database/canonical-v3.7.md`
2. `docs/database/erd/README.md`
3. ERD LV1 / LV2 / LV3
4. validated LV3 SQL
5. project-level docs
6. target bounded-context docs
7. implementation/tests

When a lower layer conflicts with frozen authority, correct the lower layer rather than stopping to choose between equal sources.