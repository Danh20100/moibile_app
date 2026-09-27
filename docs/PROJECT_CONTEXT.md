# Project Context

Status: Current product/domain context below Canonical v3.7 / frozen ERD3 authority.

## 1. Product definition

TrọƠi is a rental-lifecycle platform centered on a structured operational record for rental assets and rental relationships. Search/discovery may exist as a supporting surface, but operational ownership remains separated from public discovery projections.

The backend must preserve business facts across the room lifecycle: room state, rental relationship, agreed terms, receivable obligations, actual payments, deposit handling, incidents, evidence/history and controlled trust flows.

## 2. Authority

This document is not the highest domain authority. Read and apply:

`docs/database/canonical-v3.7.md` → ERD LV1 → ERD LV2 → ERD LV3 → validated PostgreSQL/PostGIS reference DDL → this project context → module docs → implementation.

If this document conflicts with a frozen invariant, this document must be corrected.

## 3. Actors and identity

`USER` means digital identity only. The current model does **not** assign a global `owner`, `operator` or `tenant` business role to a User.

A person may simultaneously browse, participate in a tenancy, have participated in a former tenancy, and operate an Organization through the relationships that actually establish those facts.

Current relationship concepts include:

- `ORGANIZATION.primary_owner_user_id` for the MVP workspace owner reference;
- `TENANCY_PARTICIPANT` for rental participation, with optional linkage to a User;
- resource- and relationship-based authorization rather than a global User business role.

Advanced organization team/member delegation is FUTURE unless Canonical is revised.

## 4. Current domain ownership

### USER
Digital identity. No global landlord/tenant/operator role.

### ORGANIZATION
Rental operating workspace. A User may participate in zero or more Organizations; the MVP model freezes one primary owner/operator reference per Organization.

### PROPERTY
Property identity, `ACTIVE | ARCHIVED` lifecycle, operational address/location and a separate public-location projection boundary. Archive is a guarded workflow, not an unrestricted status patch.

### ROOM
Rental-unit identity plus two independent dimensions:

- `operational_state = VACANT | OCCUPIED | MAINTENANCE | INACTIVE`
- `record_lifecycle = ACTIVE | ARCHIVED`

Room does not own agreed rent price. Archive requires `INACTIVE`, no non-terminal Tenancy and no open Incident.

### LISTING
Public discovery projection of a Room. Lifecycle:

`DRAFT | PUBLISHED | UNPUBLISHED | ARCHIVED`

Publishing requires a VACANT active Room under an active Property. When a Room leaves `VACANT`, the current Listing is synchronously unpublished. A Room has at most one current/non-archived Listing.

### TENANCY
Rental relationship for one Room. Lifecycle:

`DRAFT → ACTIVE`, `DRAFT → CANCELLED`, `ACTIVE → ENDING`, `ENDING → ACTIVE`, `ENDING → ENDED`.

A Room has at most one non-terminal Tenancy (`DRAFT | ACTIVE | ENDING`). A next draft cannot be created while the current Tenancy is `ENDING`.

### TENANCY_PARTICIPANT
Participation is distinct from User identity. An active Tenancy has exactly one active `PRIMARY` participant and zero or more active `OCCUPANT` participants. Participant linkage to `USER` is optional.

### TENANCY_TERMS
Versioned agreed terms. Terms own rent, deposit requirement, dates, billing rules, utility rules and minimum-rental conditions. Terms acknowledgements are version-specific. Financial changes apply from the next billing boundary; MVP does not prorate.

### BILLING_CYCLE / CHARGE
Receivable obligations. Current charge types are exactly:

`RENT | ELECTRICITY | WATER`

### PAYMENT
Actual money inflow belonging to exactly one Tenancy. Only confirmed Payment counts as received money. Sources are `MANUAL_CASH | MANUAL_TRANSFER | GATEWAY`; verification is `USER_RECORDED | PROVIDER_VERIFIED`.

Payment allocation uses `Payment → PaymentAllocation → Charge`. Deposit funding uses `Payment → DepositPaymentApplication → Deposit`. Allocation/application facts cannot cross Tenancy and their combined amount cannot exceed `Payment.amount`.

Confirmed Payment is corrected by void/reverse plus a new Payment rather than destructive mutation. Unallocated Payment policy remains OPEN where Canonical says OPEN.

### RECEIPT
Evidence derived from an eligible confirmed Payment. Lifecycle `ISSUED | VOIDED`; zero or more historical receipts may exist, with at most one current receipt. Receipt is not the Payment record.

### DEPOSIT
Deposit requirement belongs to Terms. Deposit fulfillment/holding/settlement belongs to Deposit and its application/event/settlement records. Refund is outbound money movement, not a negative Payment.

### INCIDENT
Problem lifecycle with categories:

`ELECTRICAL | PLUMBING | ACCESS_SECURITY | ROOM_FACILITY | APPLIANCE | OTHER`

Lifecycle:

- `REPORTED → ACKNOWLEDGED | REJECTED | CLOSED`
- `ACKNOWLEDGED → IN_PROGRESS | REJECTED`
- `IN_PROGRESS → RESOLVED | CLOSED`
- `RESOLVED → CLOSED | IN_PROGRESS`

`REJECTED` and `CLOSED` are terminal. `INCIDENT_EVENT` is append-only history.

### REVIEW / TRUST_REPORT / NOTIFICATION
Review and Trust are separate from Incident. TrustReport targets exactly one Listing or Review. Public-person rating is not implied by this model. Notification is a side-effect capability and never owns source business state.

## 5. CURRENT capabilities

CURRENT includes the frozen capabilities around user/organization/property/room, listing/search/map/basic filters/inquiry, tenant portal, tenancy/participants/terms/acknowledgement/notice, deposit, billing/charge/utility, payment/allocation/payment claim, receipt, incident/event/history, dashboard/read model, notification, review and trust reporting.

CURRENT does not mean every backend implementation is complete today; it means the capability belongs to the frozen current model.

## 6. OPEN policy discipline

Canonical `[OPEN]` items remain unresolved. Examples include Trust Report login policy and Payment unallocated handling. Lower layers must not silently close them through route guards, DTO defaults, persistence choices or comments presented as decisions.

## 7. FUTURE capabilities

FUTURE includes Subscription/Pricing/Quota, CSV/Excel import, advanced organization team/delegation, room assets, extra charge types, partner marketplace, AI/OCR, messaging, saved search, OTA integrations, proration and public ratings.

Existing pre-ERD3 code for a FUTURE capability is scaffolding only; its existence does not promote that capability into current core.

## 8. Architectural model

TrọƠi uses contract-first domain design. Business ownership, lifecycle and invariants are defined before persistence details. PostgreSQL/PostGIS is the target physical platform, but runtime migration/ORM work follows domain convergence.

Cross-context collaboration must use explicit references, decisions, events and read models. A context must not duplicate another context's authoritative business truth simply for convenience.

## 9. Reading order

1. `docs/database/canonical-v3.7.md`
2. `docs/database/erd/README.md`
3. ERD LV1 / LV2 / LV3 artifacts
4. `docs/database/schema/trooi-schema-lv3.sql`
5. `docs/PROJECT_CONTEXT.md`
6. `docs/USE_CASES.md`
7. `docs/SYSTEM_CONTEXT.md`
8. target module docs
9. implementation/tests

When a lower layer conflicts with frozen authority, change the lower layer.