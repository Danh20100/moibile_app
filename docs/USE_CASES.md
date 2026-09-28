# End-to-End Use Cases

Status: Current project-level business flows below Canonical v3.7 / frozen ERD3 authority.

This document describes behavior and ownership across bounded contexts. It does not redefine frozen lifecycle, state, ownership or CURRENT/OPEN/FUTURE classification.

## UC-01 Authenticate a User

**Goal:** establish a verified digital identity without assigning a global landlord/tenant/operator business role.

**Flow:**

1. An external identity proof is verified at the integration boundary.
2. `identity-access` normalizes the verified identity.
3. The system establishes a User reference.
4. Organization ownership, tenancy participation and resource access are determined from their own relationships, not `User.role`.

**Boundary:** authentication does not imply Organization ownership, tenancy participation or authorization to a rental resource.

## UC-02 Set Up an Organization, Property and Room

**Goal:** create the current operating structure manually.

**Flow:**

1. Establish an Organization with its primary owner reference.
2. Create a Property under that Organization.
3. Record operational address/location and public-location projection boundary.
4. Create Rooms under the Property.
5. Each Room starts from the valid current Room contract, with separate operational state and record lifecycle.

**Boundary:** CSV/Excel import is FUTURE. Existing onboarding code may orchestrate current manual creation only where it does not promote bulk/import semantics into current authority.

## UC-03 Publish a Room Listing

**Goal:** expose an eligible Room through discovery without making Listing the operational record.

**Preconditions:** Property is active; Room is active and `VACANT`.

**Flow:**

1. Create or update the Room's current Listing projection.
2. Validate publish eligibility against Property/Room state.
3. Transition Listing to `PUBLISHED`.
4. Append ListingStatusEvent history.
5. Enforce at most one current/non-archived Listing per Room.
6. If the Room leaves `VACANT`, synchronously transition the current Listing to `UNPUBLISHED`.

**Boundary:** `HIDDEN` and `RENTED` are not current Listing lifecycle states.

## UC-04 Start a Tenancy

**Goal:** establish a rental relationship without collapsing User identity, tenancy participation and agreed terms into one record.

**Flow:**

1. Select an eligible Room.
2. Create a `DRAFT` Tenancy only if no non-terminal Tenancy already exists for the Room.
3. Create one or more TenancyParticipant records; participant-to-User linkage is optional.
4. Record versioned TenancyTerms.
5. Capture version-specific acknowledgement when required by the flow.
6. Activate the Tenancy when frozen preconditions are satisfied.
7. An active Tenancy has exactly one active `PRIMARY` participant and zero or more active `OCCUPANT` participants.

**Boundary:** direct `tenantId` ownership on Tenancy and embedded mutable terms are pre-ERD3 semantics.

## UC-05 End or Cancel a Tenancy

**Goal:** follow the frozen lifecycle and keep Room state coordinated.

**Flow:**

- Draft tenancy may transition `DRAFT → CANCELLED`.
- Active tenancy transitions `ACTIVE → ENDING`.
- `ENDING → ACTIVE` is allowed when move-out is reversed before checkout.
- Confirmed checkout atomically performs `ENDING → ENDED` and Room → `VACANT`.

A next draft Tenancy cannot be created while the current Tenancy is `ENDING`.

**Boundary:** direct `ACTIVE → ENDED` is not a valid current transition.

## UC-06 Record Terms and Generate Receivable Obligations

**Goal:** derive receivable obligations from the applicable Terms version without making mutable cycle summaries the financial source of truth.

**Flow:**

1. Select the applicable TenancyTerms version for the billing period.
2. Create a BillingCycle that records the relevant tenancy/terms provenance.
3. Create Charges using only current charge types: `RENT`, `ELECTRICITY`, `WATER`.
4. Utility usage may be represented through UtilityConnection and MeterReading where applicable.
5. Read models may derive total, paid or outstanding values from authoritative facts.

**Boundary:** service/other arbitrary charge types are not current core. MVP does not prorate unless Canonical changes.

## UC-07 Record an Actual Payment

**Goal:** record received money distinctly from claims, receipts and receivable obligations.

**Flow:**

1. Record a Payment belonging to exactly one Tenancy.
2. Source is one of `MANUAL_CASH | MANUAL_TRANSFER | GATEWAY`.
3. Verification is `USER_RECORDED | PROVIDER_VERIFIED`.
4. Only confirmed Payment counts as received money.
5. Allocate Payment to Charges through PaymentAllocation.
6. Apply Payment to Deposit through DepositPaymentApplication when applicable.
7. Ensure allocation/application facts stay within the same Tenancy.
8. Ensure allocation + deposit application total does not exceed `Payment.amount`.

**Correction rule:** confirmed Payment is corrected through void/reverse plus a new Payment, not destructive mutation.

**OPEN:** handling of unallocated Payment remains unresolved where Canonical marks it OPEN.

## UC-08 Handle Deposit Fulfillment and Settlement

**Goal:** separate the deposit requirement from money received and later settlement.

**Flow:**

1. Deposit requirement originates in TenancyTerms.
2. Deposit fulfillment uses DepositPaymentApplication from confirmed Payment.
3. Deposit tracks holding/fulfillment state.
4. Settlement/refund uses DepositSettlement and DepositEvent history.
5. Settlement cannot exceed the amount funded into the Deposit.

**Boundary:** a refund is outbound money movement, not a negative Payment.

## UC-09 Issue Receipt Evidence

**Goal:** create evidence for an eligible confirmed Payment.

**Flow:**

1. Select a confirmed Payment.
2. Issue a Receipt linked to that Payment.
3. Receipt lifecycle is `ISSUED | VOIDED`.
4. Historical receipts may remain, but at most one is current.

**Boundary:** Receipt is not the Payment record and does not send a mutable payment outcome into Billing.

## UC-10 Report and Resolve an Incident

**Goal:** track a room-related problem with append-only history.

**Categories:** `ELECTRICAL | PLUMBING | ACCESS_SECURITY | ROOM_FACILITY | APPLIANCE | OTHER`.

**Lifecycle:**

- `REPORTED → ACKNOWLEDGED | REJECTED | CLOSED`
- `ACKNOWLEDGED → IN_PROGRESS | REJECTED`
- `IN_PROGRESS → RESOLVED | CLOSED`
- `RESOLVED → CLOSED | IN_PROGRESS`

`REJECTED` and `CLOSED` are terminal.

Every meaningful transition/history fact is appended through IncidentEvent. A Room with an open Incident cannot be archived.

## UC-11 Archive a Room or Property

**Goal:** archive operational records only when blockers are cleared.

**Room archive:** Room must be `INACTIVE`, must have no non-terminal Tenancy and no open Incident. Listings are archived as part of the archive workflow.

**Property archive:** Property lifecycle is `ACTIVE | ARCHIVED`; archive prevents invalid child reactivation and must respect frozen child-state blockers.

**Boundary:** archive is a guarded command/workflow, not a generic status patch.

## UC-12 Tenant Portal Interaction

**Goal:** let a User participate in rental flows through relationship-based access.

Depending on the linked TenancyParticipant and authorization context, the portal may expose tenancy/terms information, payment/receipt evidence, incident creation/history, notices and other CURRENT capabilities.

**Boundary:** tenant capability is established by rental relationships, not a global `User.role = tenant`.

## UC-13 Review and Trust Report

**Goal:** support current review/trust capabilities without turning them into public personal scoring.

Review eligibility is derived from eligible ended-tenancy participation. TrustReport targets exactly one Listing or Review and is distinct from Incident.

**OPEN:** login requirement, rate limit, moderation/evidence details and other Canonical OPEN policies remain unresolved in lower layers.

## UC-14 Dashboard / Search / Notification

Dashboard and search/map are read surfaces. Notification is a side effect. None becomes write authority for the underlying source domain.

## Scope classification

### CURRENT

Current authority includes Organization/Property/Room, Listing/search/map/basic filters/Inquiry, tenant portal, Tenancy/Participant/Terms/Acknowledgement/Notice, Deposit, Billing/Charge/Utility, Payment/Allocation/PaymentClaim, Receipt, Incident/Event/history, dashboard/read models, Notification, Review and TrustReport.

### OPEN

Any Canonical `[OPEN]` item remains undecided here. This document does not choose a default.

### FUTURE

Subscription/Pricing/Quota, CSV/Excel import, advanced organization team/delegation, room assets, extra charge types, partner marketplace, AI/OCR, messaging, saved search, OTA integrations, proration and public ratings are FUTURE unless Canonical is revised.