# TrọƠi — ERD LV2 Logical Design

**Date:** 2026-09-27
**Status:** Design approved for written-spec review
**Branch:** `database/schema-foundations`

## 1. Purpose

LV2 chuyển conceptual backbone đã được duyệt thành **logical data model** đủ rõ để thiết kế LV3 physical candidate mà không phải suy đoán lại ownership, provenance hoặc cardinality.

Nguồn authoritative:

```text
docs/database/canonical.md                    — Canonical v3.6
docs/database/erd/trooi-erd-lv1-conceptual.json — LV1 approved input
```

LV2 phải trả lời:

1. Logical entity nào cần tồn tại độc lập?
2. Entity nào sở hữu business fact nào?
3. Relationship/cardinality/uniqueness logic nào phải được enforce ở LV3?
4. Event/junction/provenance nào phải được giữ thay vì flatten thành field?

LV2 **không** quyết định PostgreSQL datatype, index, SQL CHECK syntax, FK action, ORM mapping hoặc migration.
## 2. Abstraction boundary

LV2 được phép có:

```text
logical identifiers
business attributes
logical nullability/cardinality
logical uniqueness
state vocabularies
junction entities
append-only event entities
cross-entity invariants
```

LV2 chưa có:

```text
UUID/BIGINT/DECIMAL implementation choice
PostgreSQL enum/check implementation
index / partial unique index
ON DELETE / ON UPDATE
PostGIS physical column/index
migration ordering
ORM relation decorators
```

Mọi `*_id` trong spec là **logical key/reference**, không ngầm quyết định datatype ở LV3.

## 3. Source-of-truth rule

LV2 không được tạo business truth thứ hai chỉ để tiện query.

Read model, Dashboard, Operational History projection và Notification delivery không được thay thế authoritative domain entities.
## 4. Logical entity inventory

LV2 giữ nguyên 18 backbone entities của LV1:

```text
USER
ORGANIZATION
PROPERTY
ROOM
LISTING
TENANCY
TENANCY_PARTICIPANT
TENANCY_TERMS
DEPOSIT
BILLING_CYCLE
CHARGE
PAYMENT
RECEIPT
INCIDENT
INCIDENT_EVENT
INQUIRY
REVIEW
TRUST_REPORT
```

LV2 bổ sung 11 first-class logical/supporting entities:

```text
LISTING_STATUS_EVENT
TERMS_ACKNOWLEDGEMENT
TENANCY_NOTICE
PAYMENT_ALLOCATION
PAYMENT_CLAIM
DEPOSIT_PAYMENT_APPLICATION
DEPOSIT_EVENT
DEPOSIT_SETTLEMENT
UTILITY_CONNECTION
METER_READING
NOTIFICATION
```

**Tổng: 29 logical entities.**
## 5. Identity / Operating domain

### USER

Owns digital identity only.

Logical attributes:

```text
user_id
```

Không có global `role = LANDLORD | TENANT`.

### ORGANIZATION

```text
organization_id
primary_owner_user_id
name
```

Rules:

- một User có thể operate `0..N` Organization;
- mỗi Organization có đúng một primary owner/operator trong MVP;
- không tạo OrganizationMembership/team/delegation entity ở LV2 hiện tại.

### PROPERTY

```text
property_id
organization_id
name
lifecycle_status: ACTIVE | ARCHIVED
operational_location
public_location_projection
```

Property thuộc đúng một Organization.
### ROOM

```text
room_id
property_id
name / label
operational_state: VACANT | OCCUPIED | MAINTENANCE | INACTIVE
record_lifecycle: ACTIVE | ARCHIVED
```

Rules:

- Room belongs to exactly one Property at a time;
- archive only from `INACTIVE`;
- no direct `OCCUPIED → MAINTENANCE/INACTIVE`;
- max one current non-archived Listing;
- max one non-terminal Tenancy (`DRAFT | ACTIVE | ENDING`);
- open Incident blocks archive.

Property assignment correction keeps Room identity only when it is truly a correction. Physical relocation/restructure creates a new Room identity.

## 6. Discovery domain

### LISTING

```text
listing_id
room_id
status: DRAFT | PUBLISHED | UNPUBLISHED | ARCHIVED
public_title
public_description
public_price_projection
public_location_projection
```

`PUBLISHED` requires Room `VACANT`, active Room lifecycle and active Property lifecycle.

Room leaving `VACANT` invalidates Published Listing synchronously.
### LISTING_STATUS_EVENT

Append-only history of Listing state transitions.

```text
listing_status_event_id
listing_id
from_status
to_status
reason_code
actor_type
actor_user_id?
trigger
occurred_at
metadata?
```

Known reason vocabulary starts with:

```text
LANDLORD_MANUAL
ROOM_OCCUPIED
ROOM_MAINTENANCE
ROOM_INACTIVE
PROPERTY_CORRECTION
MODERATION
```

System-originated transition may have no `actor_user_id`; actor semantics are preserved by `actor_type`.

### INQUIRY

```text
inquiry_id
listing_id
sender_user_id?
contact_intent / message
status
created_at
```

Inquiry is optional discovery/contact data and is never a prerequisite FK for Tenancy.

Full realtime messaging remains FUTURE.
## 7. Rental Lifecycle domain

### TENANCY

```text
tenancy_id
room_id
status: DRAFT | ACTIVE | ENDING | ENDED | CANCELLED
started_at?
ended_at?
end_reason?
```

`end_reason` vocabulary:

```text
TERM_ENDED
TENANT_INITIATED
OPERATOR_INITIATED
MUTUAL
OTHER
```

Rules:

- one Room has at most one non-terminal Tenancy;
- while one Tenancy is `ENDING`, MVP does not create the next Draft Tenancy;
- `end_date`/term end does not auto-end Tenancy;
- only confirmed checkout/handover produces `ENDED` and Room `VACANT`;
- `end_reason` does not determine Review eligibility.

### TENANCY_PARTICIPANT

```text
tenancy_participant_id
tenancy_id
user_id?
role: PRIMARY | OCCUPANT
joined_at
left_at?
```

Participant can exist without a User account.
Participant rules:

```text
ACTIVE Tenancy → exactly 1 active PRIMARY
ACTIVE Tenancy → 0..N active OCCUPANT
TENANCY_PARTICIPANT → 0..1 USER
```

Changing PRIMARY is a controlled transition; history is not overwritten.

### TENANCY_TERMS

```text
tenancy_terms_id
tenancy_id
version
rent_amount
agreed_deposit_requirement
term_start
term_end
billing_day / due_date_rule
electricity_arrangement
water_arrangement
minimal_rental_conditions
effective_from_cycle_boundary
```

Rules:

- Terms are immutable/versioned business records;
- financial changes become effective at the next Billing Cycle boundary in MVP;
- no mid-cycle prorating engine;
- agreed deposit requirement exists here, not as a second editable value on Deposit.

### TERMS_ACKNOWLEDGEMENT

```text
terms_acknowledgement_id
tenancy_terms_id
tenancy_participant_id
user_id
acknowledged_at
```

Acknowledgement belongs to one exact Terms version and one rental participant identity. `user_id` records the account action that performed the acknowledgement.
### TENANCY_NOTICE

Minimal logical model:

```text
tenancy_notice_id
tenancy_id
notice_type
issued_by_user_id
content / note
issued_at
acknowledged_by_user_id?
acknowledged_at?
```

Supported meanings include non-renewal, move-out notice and ending reminder.

Notice acknowledgement only means an account viewed/acknowledged the notice. It does not assert legal validity.

Per-recipient acknowledgement for multiple occupants is **not** introduced as a separate junction in current LV2 because canonical does not require it. If that capability becomes necessary, it is a domain extension rather than an implicit physical optimization.

## 8. Billing domain

### BILLING_CYCLE

```text
billing_cycle_id
tenancy_id
tenancy_terms_id
period_start
period_end
```

Rules:

- every Billing Cycle belongs to one Tenancy;
- every Billing Cycle references exactly one applied Terms version;
- periods for the same Tenancy do not overlap;
- `period_end >= period_start`;
- cycle length is not assumed to be 30 days.
### CHARGE

```text
charge_id
billing_cycle_id
charge_type: RENT | ELECTRICITY | WATER
amount
utility_connection_id?
start_meter_reading_id?
end_meter_reading_id?
```

Utility references are only applicable to ELECTRICITY/WATER charges. Rent charge does not require meter data.

Paid/outstanding settlement state is derived from Payment Allocation rather than stored as a second authoritative Charge truth.

Charge must be traceable:

```text
CHARGE
→ BILLING_CYCLE
→ TENANCY_TERMS version
```

No orphan Charge is allowed.

### UTILITY_CONNECTION

Represents the utility source/meter context of a Room.

```text
utility_connection_id
room_id
utility_type: ELECTRICITY | WATER
source / provider
meter_identifier?
```

Manual path remains valid. No semi-auto mode is modeled.
### METER_READING

```text
meter_reading_id
utility_connection_id
reading_value
recorded_at
recorded_by_user_id?
```

For an ELECTRICITY/WATER Charge, LV2 may reference a start and end Meter Reading. Pricing arrangement still comes from the applied `TENANCY_TERMS`; LV2 does not introduce a tariff/pricing-rule engine.

## 9. Payment domain

### PAYMENT

```text
payment_id
tenancy_id
amount
source: MANUAL_CASH | MANUAL_TRANSFER | GATEWAY
verification: USER_RECORDED | PROVIDER_VERIFIED
confirmed_at
voided_or_reversed_at?
correction_note?
replacement_payment_id?
```

Payment is authoritative actual money inflow and belongs to exactly one Tenancy.

Confirmed Payment is not destructively edited. Correction uses void/reverse plus a new corrected Payment while preserving history. The voided/reversed Payment may point to the replacement Payment through `replacement_payment_id`; the replacement must belong to the same Tenancy. This link is correction provenance, not permission to mutate the old Payment.

Gateway transaction details remain outside MVP dependency; LV2 does not collapse `Payment Intent`, gateway transaction and Payment into one concept.
### PAYMENT_ALLOCATION

Junction giữa Payment và Charge.

```text
payment_allocation_id
payment_id
charge_id
allocated_amount
```

Rules:

- supports partial payment;
- one Payment may allocate to many Charges;
- one Charge may receive many Payments over time;
- Payment and target Charge must resolve to the same Tenancy;
- total allocations plus deposit applications must not exceed Payment amount.

### PAYMENT_CLAIM

```text
payment_claim_id
tenancy_id
submitted_by_user_id
submitted_by_participant_id?
claimed_amount
evidence_reference?
status
submitted_at
reviewed_by_user_id?
reviewed_at?
resulting_payment_id?
```

Invariant:

```text
PAYMENT_CLAIM ≠ PAYMENT
```

Confirm may create/confirm a Payment; reject/unresolved claim creates no Payment. Evidence format and confirmation permission remain `[OPEN]`.
### RECEIPT

```text
receipt_id
payment_id
status: ISSUED | VOIDED
issued_at
voided_at?
replacement_receipt_id?
```

Rules:

- Receipt only comes from confirmed Payment;
- one Payment may have `0..N` historical Receipts;
- at most one Receipt is current/non-voided for one Payment;
- void/reissue preserves old Receipt history;
- Receipt does not own debt state.

## 10. Deposit domain

### DEPOSIT

```text
deposit_id
tenancy_id
```

Deposit owns fulfillment/holding/settlement history. It does **not** own a second editable expected amount.

Derived state vocabulary:

```text
EXPECTED
PARTIALLY_HELD
HELD
PENDING_SETTLEMENT
SETTLED
```

Deposit state is derived from Terms requirement + received/settlement history, not authoritative mutable input.
### DEPOSIT_PAYMENT_APPLICATION

Junction giữa confirmed Payment và Deposit.

```text
deposit_payment_application_id
payment_id
deposit_id
applied_amount
applied_at
```

Rules:

- Payment và Deposit phải resolve về cùng một Tenancy;
- application amount contributes to the Payment amount cap together with Charge allocations;
- manual cash vẫn phải đi qua Payment trước khi trở thành deposit receipt.

### DEPOSIT_SETTLEMENT

```text
deposit_settlement_id
deposit_id
refunded_amount
retained_amount
reason / note
acted_by_user_id
settled_at
```

Settlement is the provenance source for refund/retain outcomes. Refund is outbound settlement, **not** a negative/inbound Payment.

### DEPOSIT_EVENT

Append-only deposit history.

```text
deposit_event_id
deposit_id
event_type: RECEIVED | REFUNDED | RETAINED
occurred_at
payment_application_id?
settlement_id?
```

Provenance XOR depends on event type.
Provenance rules:

```text
RECEIVED
→ exactly one DEPOSIT_PAYMENT_APPLICATION
→ no DEPOSIT_SETTLEMENT provenance

REFUNDED | RETAINED
→ exactly one DEPOSIT_SETTLEMENT
→ no DEPOSIT_PAYMENT_APPLICATION provenance
```

`DEPOSIT_EVENT` does not duplicate monetary amount. `RECEIVED` amount is owned by the linked `DEPOSIT_PAYMENT_APPLICATION.applied_amount`; `REFUNDED` and `RETAINED` amounts are owned by the linked `DEPOSIT_SETTLEMENT.refunded_amount` and `retained_amount` respectively.

Refunded/Retained are settlement outcomes, not Deposit state values.

Tenancy may already be `ENDED` while Deposit remains `PENDING_SETTLEMENT`.

Policy for changing deposit requirement after partially held remains `[OPEN]` and is not invented in LV2.

## 11. Incident / Operations domain

### INCIDENT

```text
incident_id
room_id
reported_by_user_id?
category: ELECTRICAL | PLUMBING | ACCESS_SECURITY | ROOM_FACILITY | APPLIANCE | OTHER
status: REPORTED | ACKNOWLEDGED | IN_PROGRESS | RESOLVED | CLOSED | REJECTED
closure_reason?
created_at
closed_at?
```

Open Incident states are:

```text
REPORTED | ACKNOWLEDGED | IN_PROGRESS | RESOLVED
```

Open Incident blocks Room/Property archive.
### INCIDENT_EVENT

Append-only operational timeline.

```text
incident_event_id
incident_id
event_type
actor_user_id?
note?
attachment_reference?
from_status?
to_status?
occurred_at
```

Important changes such as status transition, note, attachment, reopen and close are represented as events instead of overwriting history.

Incident is distinct from Trust Report.

## 12. Review / Trust domain

### REVIEW

```text
review_id
tenancy_id
property_id
author_user_id
author_participant_id
overall_rating
comment
landlord_response?
landlord_response_by_user_id?
landlord_responded_at?
created_at
```

Baseline eligibility:

```text
TENANCY = ENDED
AND author USER is linked to an eligible TENANCY_PARTICIPANT
```

`end_reason` does not automatically block Review eligibility.
Review target remains Property/Rental Experience, not a personal landlord rating.

`REVIEW.property_id` is the authoritative Property/Rental Experience target captured at Review creation time. It is not a live derived reference to the Room's current Property. Subsequent Room/Property reassignment does not automatically retarget existing Reviews. Correction of an erroneous target, if required, must be an explicit audited action — never a cascade from Room/Property changes.

LV2 does not introduce a `REVIEW_TARGET_CORRECTION_EVENT`; correction audit belongs to the cross-cutting Technical Audit concern rather than a second business source-of-truth entity.

Current LV2 keeps the optional single landlord/operator response on `REVIEW` rather than introducing `REVIEW_RESPONSE` as a separate entity. A separate response entity is only justified if response lifecycle/moderation/history becomes first-class later.

Review edit policy, minimum occupancy duration, moderation authority and rating dimensions remain `[OPEN]`.

### TRUST_REPORT

```text
trust_report_id
reporter_user_id?
listing_id?
review_id?
reason
status: SUBMITTED | UNDER_REVIEW | RESOLVED | REJECTED
note / evidence_reference?
created_at
resolved_at?
```

Reason vocabulary:

```text
INCORRECT_INFORMATION
MISLEADING_PRICE
WRONG_LOCATION
DUPLICATE_LISTING
INAPPROPRIATE_CONTENT
SUSPECTED_FRAUD
PRIVACY_VIOLATION
SPAM
OTHER
```

Logical XOR invariant:

```text
exactly one of listing_id / review_id is present
```

One Trust Report never means automatic content removal.
Login requirement, rate limiting, moderation permissions and evidence policy remain `[OPEN]`.

## 13. Notification delivery

### NOTIFICATION

Notification is a delivery/side-effect record, never a business-state authority.

```text
notification_id
recipient_user_id
category
message / payload_reference
delivery_status
created_at
delivered_at?
read_at?
```

Notification may be triggered by Inquiry, Payment due/confirmation, Incident, Notice, Move-out, Review or Report workflows, but it does not own those workflows' state.

LV2 does not introduce a generic polymorphic authoritative `target_type/target_id` relationship. A notification may retain a non-authoritative reference/payload for navigation; the business entity remains the source of truth.

## 14. Logical relationship backbone

The following relationships must exist in the LV2 artifact:

```text
USER 0..N ──operates── ORGANIZATION
ORGANIZATION 1 ──contains── 0..N PROPERTY
PROPERTY 1 ──contains── 0..N ROOM
ROOM 1 ──projects── 0..N LISTING history
ROOM 1 ──has── 0..N TENANCY history
ROOM 1 ──has── 0..N INCIDENT
ROOM 1 ──has── 0..N UTILITY_CONNECTION
```

Current/non-terminal uniqueness remains a logical invariant, not a raw historical cardinality.
Rental/financial relationships:

```text
TENANCY 1 ──has── 0..N TENANCY_PARTICIPANT over history
TENANCY 1 ──has versions── 0..N TENANCY_TERMS
TENANCY_TERMS 1 ──acknowledged by── 0..N TERMS_ACKNOWLEDGEMENT
TENANCY 1 ──has── 0..N TENANCY_NOTICE
TENANCY 1 ──has── 0..N BILLING_CYCLE
TENANCY 1 ──has── 0..1 DEPOSIT lifecycle
TENANCY 1 ──owns── 0..N PAYMENT
TENANCY 1 ──receives── 0..N PAYMENT_CLAIM

BILLING_CYCLE 1 ──uses── exactly 1 TENANCY_TERMS version
BILLING_CYCLE 1 ──contains── 1..N CHARGE

PAYMENT N ──through PAYMENT_ALLOCATION── N CHARGE
PAYMENT N ──through DEPOSIT_PAYMENT_APPLICATION── N DEPOSIT
PAYMENT 1 ──produces── 0..N RECEIPT history
PAYMENT (voided/reversed) 0..1 ──replacement_payment_id── 0..1 PAYMENT

DEPOSIT 1 ──has── 0..N DEPOSIT_PAYMENT_APPLICATION
DEPOSIT 1 ──has── 0..N DEPOSIT_SETTLEMENT
DEPOSIT 1 ──has── 0..N DEPOSIT_EVENT

UTILITY_CONNECTION 1 ──has── 0..N METER_READING
UTILITY CHARGE ──may reference── 0..1 UTILITY_CONNECTION
UTILITY CHARGE ──may reference── start/end METER_READING on that connection
```

Trust/discovery relationships:

```text
LISTING 1 ──has── 0..N LISTING_STATUS_EVENT
LISTING 1 ──receives── 0..N INQUIRY
INQUIRY ──0..1 sender── USER

REVIEW ──exactly 1 source── TENANCY
REVIEW ──exactly 1 author identity── USER
REVIEW ──exactly 1 author rental identity── TENANCY_PARTICIPANT
REVIEW ──exactly 1 target── PROPERTY

TRUST_REPORT ──XOR target── LISTING | REVIEW
USER 1 ──receives── 0..N NOTIFICATION
```
Supporting/provenance relationships:

```text
LISTING_STATUS_EVENT ──belongs to── exactly 1 LISTING
LISTING_STATUS_EVENT ──actor── 0..1 USER

TERMS_ACKNOWLEDGEMENT ──belongs to── exactly 1 TENANCY_TERMS
TERMS_ACKNOWLEDGEMENT ──rental identity── exactly 1 TENANCY_PARTICIPANT
TERMS_ACKNOWLEDGEMENT ──account action── exactly 1 USER

TENANCY_NOTICE ──belongs to── exactly 1 TENANCY
TENANCY_NOTICE ──issued by── exactly 1 USER
TENANCY_NOTICE ──acknowledged by── 0..1 USER

PAYMENT_CLAIM ──belongs to── exactly 1 TENANCY
PAYMENT_CLAIM ──submitted by── exactly 1 USER
PAYMENT_CLAIM ──participant context── 0..1 TENANCY_PARTICIPANT
PAYMENT_CLAIM ──resulting payment── 0..1 PAYMENT

DEPOSIT_PAYMENT_APPLICATION ──source── exactly 1 PAYMENT
DEPOSIT_PAYMENT_APPLICATION ──target── exactly 1 DEPOSIT
DEPOSIT_EVENT(RECEIVED) ──provenance── exactly 1 DEPOSIT_PAYMENT_APPLICATION
DEPOSIT_EVENT(REFUNDED/RETAINED) ──provenance── exactly 1 DEPOSIT_SETTLEMENT

INCIDENT_EVENT ──belongs to── exactly 1 INCIDENT
INCIDENT_EVENT ──actor── 0..1 USER
```

## 15. Logical invariants carried into LV3

LV3 must be able to implement these logical constraints without changing their meaning:

1. No global landlord/tenant role on USER.
2. Each Organization has exactly one primary owner/operator in MVP.
3. Each Property belongs to exactly one Organization.
4. Room operational state and archive lifecycle remain separate.
5. Published Listing requires eligible VACANT active Room under active Property.
6. One Room has at most one current non-archived Listing.
7. One Room has at most one non-terminal Tenancy.
8. Active Tenancy has exactly one active PRIMARY participant.
9. Participant may exist without a linked User.
10. Terms are versioned and acknowledgement is version-specific.
11. Financial Terms change only at the next Billing Cycle boundary in MVP.
12. Every Billing Cycle stores its applied Terms version provenance.
13. Billing Cycle periods for one Tenancy do not overlap.
14. Charge types are exactly RENT/ELECTRICITY/WATER in current scope.
15. Payment belongs to exactly one Tenancy.
16. Payment Allocation may be partial/multi-charge/multi-cycle but never cross-Tenancy.
17. Deposit Payment Application never crosses Tenancy.
18. Sum of Payment Allocation + Deposit Payment Application amounts cannot exceed Payment amount.
19. Payment Claim is not Payment.
20. Confirmed Payment correction preserves history; `replacement_payment_id`, when present, links a voided/reversed Payment to its corrected Payment in the same Tenancy.
21. Receipt is derived from confirmed Payment and has max one current/non-voided record per Payment.
22. Deposit requirement truth belongs to Terms.
23. Deposit state is derived, not authoritative mutable input.
24. RECEIVED Deposit Event provenance is a Deposit Payment Application; its monetary amount is owned only by `DEPOSIT_PAYMENT_APPLICATION.applied_amount`, not duplicated on DEPOSIT_EVENT.
25. REFUNDED/RETAINED Deposit Event provenance is a Deposit Settlement; monetary outcome is owned only by `DEPOSIT_SETTLEMENT.refunded_amount` / `retained_amount`, not duplicated on DEPOSIT_EVENT.
26. Open Incident blocks Room/Property archive.
27. Trust Report targets exactly one Listing or Review.
28. Trust Report does not auto-remove content.
29. Review target is Property/Rental Experience, not a person.
30. Notification/History/Dashboard do not own business truth.
31. TENANCY_TERMS.version is unique within one Tenancy.
32. A Terms Acknowledgement participant belongs to the same Tenancy as the acknowledged Terms; its User is the linked account performing that action.
33. For an ELECTRICITY/WATER Charge, when utility provenance is recorded: the referenced Utility Connection belongs to the Room of the Charge's Billing Cycle Tenancy; its utility type matches the Charge type; and any start/end Meter Readings belong to that same Utility Connection. Meter readings cannot be referenced without their Utility Connection.
34. Review author Participant belongs to the Review Tenancy and is linked to the Review author User.
35. Payment Claim participant, when present, belongs to the same Tenancy as the claim.
36. `REVIEW.property_id` is captured at Review creation time and is not live-synced to the current Tenancy → Room → Property chain. Subsequent Room/Property reassignment does not retarget existing Reviews. Correction of an erroneous target is an explicit audited action, never a cascade.
37. `PAYMENT_CLAIM.resulting_payment_id`, when present, belongs to the same Tenancy as the Payment Claim.
## 16. Explicit OPEN policies

The following remain intentionally unresolved in LV2 and must not be silently encoded as fixed business policy:

```text
Payment unallocated amount handling
Payment Claim evidence format
Payment Claim confirmation permission
Deposit requirement change after partially held
Review minimum occupancy duration
Review edit policy
Review moderation authority
Review target (`property_id`) correction authority
Review rating dimensions
Trust Report login requirement
Trust Report rate limit
Trust Report moderation permissions
Trust Report evidence policy
Notification delivery channels
```

LV2 may contain fields needed to preserve data for these workflows, but it does not invent a policy outcome.

## 17. Explicitly not authoritative tables

Do not create standalone source-of-truth entities for:

```text
DASHBOARD
OPERATIONAL_HISTORY
TECHNICAL_AUDIT as business entity
SEARCH_INDEX
MAP_PROJECTION
```

Operational History is derived from domain records/events. Technical Audit is cross-cutting infrastructure and belongs to implementation design, not the business logical ERD.

Search/Map read Published Listing projection; they do not own rental truth.
## 18. FUTURE scope excluded from LV2

Do not introduce logical entities for:

```text
Subscription / Pricing tiers / quota gating
CSV / Excel import
advanced team/staff delegation
Room Asset Inventory
generic Service/WiFi/Parking/Other charges
Partner marketplace / worker dispatch / commission
AI / OCR / predictive features
full realtime messaging
saved search / advanced favorites
OTA reservation / instant booking
nightly calendar / dynamic pricing
proration engine
public tenant rating
public personal landlord rating
```

Payment gateway is future-compatible but not an MVP dependency; LV2 keeps Payment source vocabulary compatible without introducing gateway-specific tables as current core.

## 19. LV2 visual organization

Lucid LV2 should preserve the six domain regions from LV1 but visually distinguish:

```text
Core entity      → stronger fill/border
Junction entity  → compact neutral block
Event entity     → append-only/event visual marker
Delivery entity  → non-authoritative side-effect marker
```

Recommended region order:

```text
Identity / Operating
→ Discovery
→ Rental Lifecycle
→ Billing / Financial
→ Operations
→ Trust / Delivery
```

Logical junctions should sit physically between the entities they connect to minimize line crossings.
## 20. Output artifact

After this spec is approved, LV2 repository artifact will be created at:

```text
docs/database/erd/trooi-erd-lv2-logical.json
```

The snapshot must contain:

```text
source metadata
LV1 source reference
logical entities
logical attributes
relationship/cardinality definitions
state vocabularies
logical constraints/invariants
OPEN policy list
FUTURE exclusions
```

Initial status:

```text
DRAFT_REVIEW
```

Lucid is the collaboration/review surface. Repository JSON is the reviewable/version-controlled logical artifact.

LV2 JSON must not depend on Lucid internal shape IDs.

## 21. LV1 freeze gate

Before the first LV2 snapshot is committed, the approved LV1 snapshot must be marked:

```text
REVIEWED_FROZEN
```

LV2 may elaborate LV1 relationships using junction/supporting entities, but it must not contradict or silently replace an LV1 invariant.
## 22. Validation checklist

LV2 is ready for review only when:

- all 18 LV1 entities remain represented;
- all 11 LV2 additions are present exactly once;
- `TENANCY_TERMS → BILLING_CYCLE` provenance remains explicit;
- deposit requirement is not duplicated outside Terms;
- `PAYMENT_ALLOCATION` and `DEPOSIT_PAYMENT_APPLICATION` are real junction entities;
- Payment/Charge/Deposit application cannot cross Tenancy;
- Deposit RECEIVED vs REFUNDED/RETAINED provenance is distinguishable;
- Receipt history/current rule is explicit;
- Billing Cycle overlap and Terms version rules are explicit;
- Utility readings do not create a second pricing source outside Terms;
- Incident event history stays append-only;
- Notice acknowledgement is not described as legal signature;
- Review links rental identity, account identity, Tenancy and Property;
- Trust Report XOR target is explicit;
- Notification remains non-authoritative;
- `[OPEN]` policies remain marked open;
- `[FUTURE]` features do not leak into logical core;
- no PostgreSQL datatype/index/SQL implementation detail appears as a design dependency.

If satisfying one item requires a new business rule not supported by Canonical v3.6, stop and escalate the rule back to canonical instead of inventing it in LV2.

## 23. Success criteria

A reviewer should be able to answer from LV2 alone:

```text
Which logical record owns each business fact?
Which relationships need junction entities?
How does a payment reach rent charges and deposit without losing provenance?
How does deposit receipt differ from deposit settlement?
Which Terms version produced a Billing Cycle?
How is tenant account identity separated from rental participant identity?
How are Listing/Incident/Deposit histories preserved?
Which constraints must LV3 enforce physically?
Which policies are intentionally still open?
```

without reading SQL or inferring missing relationships from application code.
