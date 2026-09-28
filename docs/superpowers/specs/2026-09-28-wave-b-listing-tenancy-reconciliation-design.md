# Wave B Listing + Tenancy Reconciliation Design

**Status:** Design for review — implementation plan and implementation are blocked until this written spec is approved  
**Date:** 2026-09-28  
**Repository:** `onsra520/TroOi-Project`  
**Target branch:** `backend/core-foundations`  
**Baseline HEAD:** `a7f49cd7e611066abdb1d43d39cd9d8cb2cd8626`  
**Authority:** `docs/database/canonical-v3.7.md` → reviewed/frozen ERD LV1 → ERD LV2 → ERD LV3 → validated PostgreSQL/PostGIS reference DDL  
**Parent reconciliation design:** `docs/superpowers/specs/2026-09-28-erd3-backend-reconciliation-design.md`  
**Predecessor handoff:** Core H0–H6 freeze recorded by `docs/audits/2026-09-28-erd3-conformance-red-baseline.md`

## 1. Purpose

Wave B reconciles the discovery-to-rental boundary after the core Identity / Organization / Property / Room rebuild. It replaces the remaining pre-freeze Listing and Tenancy contracts with the frozen Canonical v3.7 / ERD3 model, while preserving the existing core boundaries already proven GREEN.

The output of Wave B is a domain-correct, testable in-memory backend boundary for:

```text
Listing
ListingStatusEvent
Inquiry
Tenancy
TenancyParticipant
TenancyTerms
TermsAcknowledgement
TenancyNotice
```

Wave B does **not** wire PostgreSQL persistence. It makes the domain contracts and orchestration stable enough for Wave C finance work and for the later PostgreSQL application-wiring gate.

## 2. Success Criteria

Wave B is complete only when all of the following are true:

1. Listing lifecycle is exactly `DRAFT | PUBLISHED | UNPUBLISHED | ARCHIVED` and old `hidden` / `rented` semantics are gone.
2. Listing references Room as its authoritative operational parent; it does not duplicate `propertyId` as ownership truth.
3. Listing publish validates VACANT active Room under active Property.
4. Room leaving VACANT synchronously unpublishes a current PUBLISHED Listing.
5. A Room has at most one current non-archived Listing.
6. Listing lifecycle transitions append first-class `ListingStatusEvent` history.
7. Inquiry remains a separate discovery/contact bridge and is not a prerequisite for Tenancy.
8. Tenancy lifecycle is exactly `DRAFT | ACTIVE | ENDING | ENDED | CANCELLED` with the frozen transition graph.
9. A Room has at most one non-terminal Tenancy, where non-terminal is `DRAFT | ACTIVE | ENDING`.
10. A Room with an `ENDING` Tenancy cannot receive a next DRAFT Tenancy in MVP.
11. `TenancyParticipant` is distinct from User and may exist without a linked User.
12. Activation requires exactly one active PRIMARY participant.
13. `TenancyTerms` is first-class and versioned; old embedded mutable terms are removed.
14. `TermsAcknowledgement` points to one Terms version and satisfies the frozen same-Tenancy / linked-user consistency rule.
15. `TenancyNotice` records communication without creating legal-effect semantics.
16. Confirmed checkout performs `ENDING → ENDED` and Room `OCCUPIED → VACANT` as one cross-domain command boundary.
17. Checkout does not automatically republish a Listing.
18. Listing and Tenancy conformance tests are GREEN; remaining expected RED is limited to named later waves.
19. No `[OPEN]` policy is silently resolved.
20. No Wave C/D/E/persistence capability is pulled into Wave B for convenience.

## 3. Current Baseline

Core H6 is runtime-verified GREEN for authority, Identity, Organization, Property, Room, the FUTURE runtime boundary, TypeScript typecheck, and frozen database validators.

The current Listing and Tenancy implementations are intentionally still pre-freeze:

```text
Listing
- lifecycle still uses draft / published / hidden / rented
- duplicates propertyId beside roomId
- uses presentation fields that do not match the frozen physical projection
- has no first-class ListingStatusEvent history
- has no synchronous Room-leaves-VACANT invalidation workflow

Tenancy
- embeds tenantId directly
- embeds a mutable terms object
- is missing CANCELLED
- still permits old lifecycle assumptions
- has no first-class Participant / Terms version / TermsAcknowledgement / Notice model
- has no full checkout orchestration
```

The current ERD3 audit assigns exactly these Listing and Tenancy failures to Wave B. Finance remains Wave C; Incident / Trust remain Wave D.

## 4. Scope

### 4.1 IN

Wave B owns:

```text
Listing
ListingStatusEvent
Inquiry
Tenancy
TenancyParticipant
TenancyTerms
TermsAcknowledgement
TenancyNotice

Listing ↔ Room coordination
Listing ↔ Property eligibility reads through Room
Tenancy ↔ Room coordination
Tenancy activation / checkout causality
Room-leaves-VACANT → Listing unpublish coordination
```

It may update module contracts, DTOs, services, controllers, Nest module wiring, focused behavior tests, ERD3 conformance tests, module docs, and the conformance audit where required by observed runtime evidence.

### 4.2 OUT

Wave B does not implement or redesign:

```text
BillingCycle / Charge
Payment / PaymentAllocation / PaymentClaim
Deposit / DepositPaymentApplication / DepositSettlement / DepositEvent
Receipt
UtilityConnection / MeterReading
Incident / IncidentEvent
Review / TrustReport
Notification / read models
resource authorization / role policy
PostgreSQL application wiring
Redis
Search ranking / recommendation
saved search / favorites
viewing appointments / reservation / hold
proration
public personal ratings
```

Wave B also does not change frozen database ownership, cardinality, checks, indexes, or transaction-guard meaning.

## 5. Non-Negotiable Constraints

- Canonical v3.7 / frozen ERD3 wins over old backend behavior.
- Old Listing/Tenancy API contracts may be intentionally broken; no compatibility adapter is required for superseded semantics.
- USER remains digital identity only. Do not introduce a global landlord / tenant role.
- Listing is discovery projection; Room is operational truth.
- Listing owns no second authoritative Property relationship.
- Search/Map room/property type owner and vocabulary remains `[OPEN]`; Wave B must not define it.
- Inquiry `status` has no frozen closed vocabulary in the current physical contract. Wave B must not invent a closed lifecycle for it.
- Listing status-event `actor_type`, `trigger`, and extensible reason-code details must not be promoted to a new closed vocabulary unless already frozen by authority.
- Tenancy participant replacement policy must preserve history; Wave B must not invent destructive PRIMARY replacement semantics.
- Notice acknowledgement means view/acknowledge only; it is not legal-effect confirmation.
- Financial Terms changes take effect from a billing-cycle boundary. Wave B stores `effectiveFromCycleBoundary`; it does not implement proration or BillingCycle behavior.
- Domain services may remain in-memory during Wave B, but in-memory state is only a temporary scaffold. It must not be described as production persistence or transaction-safe enforcement.
- Persistence/concurrency proof remains owned by the database lane. Wave B tests domain causality and precondition behavior only.
- No force-push or history rewrite is part of this work.

## 6. Domain Design

### 6.1 Listing

Listing is the public discovery projection for one Room.

Frozen lifecycle:

```text
DRAFT → PUBLISHED
PUBLISHED → UNPUBLISHED
UNPUBLISHED → PUBLISHED
DRAFT → ARCHIVED
UNPUBLISHED → ARCHIVED
ARCHIVED = terminal
```

Direct transitions not in that graph are rejected.

The domain contract should represent the frozen Listing facts rather than the old convenience model:

```text
id
roomId
status
publicTitle
publicDescription
publicPriceProjection
publicLocationProjection
```

The physical contract has no authoritative Listing `propertyId`; Property is derived through Room.

The physical contract also does not require `createdAt`, `updatedAt`, or old `publishedAt` fields on Listing itself. Lifecycle time/history belongs to `ListingStatusEvent`. Wave B must not retain those old fields merely for compatibility if they would become duplicate business history.

Public price is monetary data. The Wave B contract must avoid introducing floating-point business truth that would conflict with the exact PostgreSQL numeric boundary. The implementation plan should use a decimal-string boundary or another exact representation compatible with the already-approved persistence design; it must not perform authoritative money arithmetic with JavaScript floating point.

`publicLocationProjection` is the public-safe projection. Exact Property operational location must not leak into Listing public APIs.

### 6.2 Listing Publish Eligibility

A publish command succeeds only when:

```text
Listing is DRAFT or UNPUBLISHED
Room.recordLifecycle = ACTIVE
Room.operationalState = VACANT
Property.lifecycleStatus = ACTIVE
Listing required public projection fields are valid
```

On success:

```text
Listing → PUBLISHED
append ListingStatusEvent
```

A publish command must validate current Room / Property state at command time. A stale earlier read is not sufficient evidence of eligibility.

Wave B does not claim this check is concurrency-safe in production persistence. The database lane owns the final transaction lock implementation for `listing_publish_eligibility`.

### 6.3 Single Current Listing

For one Room:

```text
0..N historical ARCHIVED Listings
max 1 Listing whose status != ARCHIVED
```

Wave B enforces the semantic invariant in its in-memory domain service and tests it. The frozen physical partial unique index remains the production persistence enforcement layer later.

### 6.4 ListingStatusEvent

Each important Listing status change appends an event containing the frozen physical facts:

```text
id
listingId
fromStatus
toStatus
reasonCode
actorType
actorUserId?
trigger
occurredAt
metadata?
```

Event history is append-only. Existing events are not rewritten when the Listing changes again.

Canonical already identifies these known reason codes:

```text
LANDLORD_MANUAL
ROOM_OCCUPIED
ROOM_MAINTENANCE
ROOM_INACTIVE
PROPERTY_CORRECTION
MODERATION
```

They may be used where applicable, but Wave B does not assert that this list is a permanently closed enum because the authority explicitly leaves reason-code expansion below the conceptual layer.

### 6.5 Inquiry

Inquiry is a contact bridge from a Listing toward a possible rental relationship.

Frozen facts:

```text
id
listingId
senderUserId?
contactIntentOrMessage
status
createdAt
```

Key behavior:

```text
Listing → Inquiry → possible Tenancy
Room → direct Tenancy creation is also valid
Inquiry is never required to create Tenancy
```

Wave B does not turn Inquiry into booking, reservation, viewing appointment, realtime chat, hold, or future-tenancy reservation.

Because the frozen authority does not define a closed Inquiry status vocabulary, Wave B must not invent one. It may preserve `status` as an opaque field only to the extent needed by the frozen entity shape; no new status FSM is created in this wave.

### 6.6 Tenancy

Tenancy is one rental relationship for one Room over time.

Frozen lifecycle:

```text
DRAFT → ACTIVE
DRAFT → CANCELLED
ACTIVE → ENDING
ENDING → ACTIVE
ENDING → ENDED
ENDED = terminal
CANCELLED = terminal
```

Not allowed:

```text
ACTIVE → ENDED directly
ENDED → anything
CANCELLED → anything
```

Frozen Tenancy facts:

```text
id
roomId
status
startedAt?
endedAt?
endReason?
```

The old `tenantId` and embedded `terms` fields are removed from Tenancy itself.

End reason is only recorded on confirmed completion of the ending workflow and uses the frozen neutral vocabulary:

```text
TERM_ENDED
TENANT_INITIATED
OPERATOR_INITIATED
MUTUAL
OTHER
```

It must not encode fault/adjudication semantics.

### 6.7 One Non-Terminal Tenancy per Room

At most one of the following may exist for a Room:

```text
DRAFT
ACTIVE
ENDING
```

Historical `ENDED` / `CANCELLED` Tenancies are unlimited over time.

Creation of a new DRAFT is rejected while any non-terminal Tenancy exists, including `ENDING`.

Inquiry remains the mechanism for pre-rental interest while a Room is still occupied / ending. Wave B does not add pre-leasing semantics.

### 6.8 TenancyParticipant

Participant is not User.

Frozen shape:

```text
id
tenancyId
userId?
role = PRIMARY | OCCUPANT
joinedAt
leftAt?
```

Rules:

```text
participant may exist without User link
active Tenancy requires exactly one active PRIMARY
at most one active PRIMARY at a time
0..N active OCCUPANT participants
participant history is preserved when occupant membership changes
unlinking/removing a User account must not erase Participant history
```

A participant is active when `leftAt` is absent for the relevant current relationship.

Wave B must use controlled participant changes rather than destructive overwrite. Exact future team/delegation/authorization policy is out of scope.

### 6.9 TenancyTerms

Terms is a first-class, versioned concept. The Wave B contract aligns with the frozen physical shape:

```text
id
tenancyId
version
rentAmount
agreedDepositRequirement
termStart
termEnd
billingDayOrDueDateRule
electricityArrangement
waterArrangement
minimalRentalConditions
effectiveFromCycleBoundary
```

Rules:

```text
version > 0
version is unique within one Tenancy
termEnd >= termStart
rentAmount >= 0
agreedDepositRequirement >= 0
old versions are immutable historical facts
new terms create a new version; they do not overwrite prior versions
```

The JSON rule/arrangement fields stay opaque unless their internal vocabulary is already frozen elsewhere. Wave B does not invent pricing-rule schemas.

Financial changes requested during an active billing period become effective at the next cycle boundary. Wave B stores provenance/effective boundary only; Wave C owns BillingCycle application.

### 6.10 TermsAcknowledgement

Frozen facts:

```text
id
tenancyTermsId
tenancyParticipantId
userId
acknowledgedAt
```

Consistency rule:

```text
Terms and Participant belong to the same Tenancy
Participant is linked to a User
Acknowledgement.userId equals that linked User
```

A participant without a linked User cannot create a User-backed acknowledgement record.

Acknowledgement is version-specific. There is no tenancy-level `termsAccepted = true` shortcut.

### 6.11 TenancyNotice

Frozen physical facts:

```text
id
tenancyId
noticeType
issuedByUserId
contentOrNote
issuedAt
acknowledgedByUserId?
acknowledgedAt?
```

The acknowledgement pair is all-or-none.

Notice records communication such as move-out / non-renewal / ending reminders. Wave B does not claim legal validity or adjudication.

The Canonical does not freeze a closed `noticeType` vocabulary here, so Wave B must not invent one as a domain authority decision.

## 7. Cross-Domain Orchestration

### 7.1 Why a Coordinator Boundary Is Required

Listing must read Room/Property eligibility, while Room state changes can invalidate Listing. Tenancy activation and checkout also mutate Room state. Making ListingService, RoomService, and TenancyService inject each other bidirectionally would create circular ownership and obscure which command owns the invariant.

Wave B therefore introduces a narrow application-level orchestration seam for commands that cross bounded contexts. The implementation-plan stage will choose the concrete file/module name consistent with current Nest structure, but the ownership rule is fixed here:

```text
Entity service
→ owns local entity state / local FSM / local history

Cross-domain coordinator
→ validates multiple contexts and invokes entity commands in causal order
```

The coordinator does not become a second data store.

### 7.2 Publish Listing

Cross-domain publish flow:

```text
load Listing
load Room
load Property through Room
validate Listing transition
validate Room VACANT + ACTIVE
validate Property ACTIVE
publish Listing
append ListingStatusEvent
```

No Property relationship is stored on Listing to avoid duplicating ownership truth.

### 7.3 Room Leaves VACANT

Any command that moves a Room from `VACANT` to another operational state must synchronously handle a current PUBLISHED Listing.

Examples:

```text
VACANT → OCCUPIED      reason ROOM_OCCUPIED
VACANT → MAINTENANCE   reason ROOM_MAINTENANCE
VACANT → INACTIVE      reason ROOM_INACTIVE
```

Required causal behavior:

```text
validate complete cross-domain command
if current Listing is PUBLISHED:
  Listing → UNPUBLISHED
  append ListingStatusEvent
then transition Room
```

The implementation must avoid a state in which the command reports success while Room is non-VACANT and Listing remains PUBLISHED.

In the in-memory Wave B scaffold, this is proved by deterministic command tests and prevalidation; production atomicity/locking remains the persistence lane responsibility.

### 7.4 Tenancy Activation

Activation requires:

```text
Tenancy = DRAFT
Room operationalState = VACANT
Room recordLifecycle = ACTIVE
Property lifecycleStatus = ACTIVE
no competing non-terminal Tenancy for the Room
exactly one active PRIMARY participant
```

Activation then causes:

```text
current PUBLISHED Listing → UNPUBLISHED, if present
append ListingStatusEvent(reason = ROOM_OCCUPIED)
Tenancy DRAFT → ACTIVE
startedAt recorded
Room VACANT → OCCUPIED with cause tenancy_activated
```

This is one application command boundary. Wave B must not expose a client route that can set Room to OCCUPIED independently.

### 7.5 Start Ending / Resume Active

These are local Tenancy lifecycle operations:

```text
ACTIVE → ENDING
ENDING → ACTIVE
```

They do not make Room VACANT and do not create a new Listing state automatically.

An `ENDING` Tenancy still blocks a next DRAFT Tenancy.

### 7.6 Confirmed Checkout

Checkout requires:

```text
Tenancy = ENDING
Room = OCCUPIED
endReason is one frozen neutral value
```

Then, as one application command boundary:

```text
Tenancy ENDING → ENDED
endedAt recorded
endReason recorded
Room OCCUPIED → VACANT with cause checkout_confirmed
```

Checkout **does not automatically republish** an old UNPUBLISHED Listing. Republish remains an explicit command that reruns publish eligibility checks.

### 7.7 Room Archive Interaction

Canonical Room archive requires related Listings to become archived. Wave B supplies the Listing-side capability required by that workflow.

The current core Room archive service still receives blockers as an internal seam. Wave B must not introduce a client-controlled flag claiming that Listing archival occurred. The final authoritative orchestration/persistence layer will own the fully atomic Room archive transaction.

## 8. API / DTO Policy

Controllers expose commands, not unrestricted status mutation.

Avoid generic endpoints such as:

```text
PATCH /listing/:id/status { status: arbitrary }
PATCH /tenancy/:id/status { status: arbitrary }
```

Preferred public command semantics are explicit, for example:

```text
publish / unpublish / archive Listing
activate / cancel / start-ending / resume / checkout Tenancy
add/leave/link Participant through controlled commands
create next Terms version
acknowledge one Terms version
issue/acknowledge Notice
```

Exact route spelling belongs to the implementation plan, but controller surfaces must not allow a client to bypass domain causes or cross-context guards.

Existing route compatibility is secondary to the frozen domain contract because these APIs are not treated as a shipped stable external contract.

## 9. Exactness and Data Semantics

### Money

`publicPriceProjection`, `rentAmount`, and `agreedDepositRequirement` must not become JavaScript floating-point source-of-truth values. Wave B should use an exact decimal-compatible representation aligned with the approved persistence design.

### Dates

Terms calendar dates remain `YYYY-MM-DD` values and are not converted through timezone-bearing Date objects for authoritative comparison.

### Timestamps

Operational event timestamps use ISO timestamps representing an instant.

### JSON business rules

Billing / utility / minimal-condition JSON values remain opaque structured data unless a frozen lower-level authority defines their internal schema. Wave B must not infer one.

### IDs

Domain IDs remain opaque strings at the Wave B contract surface. Converting all existing core modules to physical UUID generation is not part of this wave; physical UUID enforcement belongs to persistence integration. Wave B must not add new prefixed-ID semantics as business meaning.

## 10. Error Handling

Wave B distinguishes at least these failure classes at the service/controller level:

```text
not found
invalid local lifecycle transition
cross-domain eligibility failure
cardinality/invariant conflict
invalid participant/terms/acknowledgement relationship
invalid frozen vocabulary value
```

Error messages may be implementation-facing and do not become domain authority.

No error path may partially mutate an in-memory multi-entity command after a later validation fails. Cross-domain commands must validate all known preconditions before the first mutation. Where a later unexpected runtime failure could still cause partial state in the in-memory scaffold, tests/documentation must not claim database-grade atomicity; Task 17/persistence transactions are the final guarantee.

## 11. Testing Strategy

Wave B uses TDD packet-by-packet.

### Focused behavior tests

Add runtime behavior coverage for:

```text
Listing lifecycle
single-current-Listing guard
publish eligibility
ListingStatusEvent append-only history
Inquiry independence
Tenancy FSM
one-non-terminal-Tenancy guard
Participant PRIMARY/OCCUPANT rules
Terms versioning / immutability
TermsAcknowledgement consistency
Notice acknowledgement pair
activation → Listing unpublish + Room OCCUPIED
Room leaves VACANT → Listing UNPUBLISHED
checkout → Tenancy ENDED + Room VACANT
no auto-republish on checkout
```

### Existing ERD3 conformance files

`tests/conformance/erd3/listing.contract.test.ts` and `tests/conformance/erd3/tenancy.contract.test.ts` are the frozen RED-to-GREEN targets. They may be strengthened to test newly introduced public interfaces but must not be weakened to preserve old implementation semantics.

### Regression gates

Every implementation packet must run:

```text
focused packet tests
pnpm typecheck
python -m unittest discover -s tests/database -p "test_*.py"
```

The Wave B freeze additionally runs:

```text
Listing + Tenancy behavior tests
Listing + Tenancy ERD3 conformance tests
core H6 regression tests
Google identity regression
pnpm test:conformance:erd3
pnpm test
```

Final expected conformance classification:

```text
GREEN:
- authority
- Identity
- Organization
- Property / Room
- Listing
- Tenancy
- FUTURE runtime boundary

EXPECTED RED only:
- Finance — Wave C
- Incident / Trust — Wave D
```

Any unexplained import, typecheck, harness, test-discovery, or previously GREEN core regression is a defect, not an expected RED.

## 12. Delivery Packets

The implementation plan must decompose Wave B into these reviewable packets:

```text
B0 — capture fresh Wave B baseline and hard gates
B1 — rebuild Listing contract + lifecycle
B2 — add ListingStatusEvent + Inquiry
B3 — rebuild Tenancy core contract + lifecycle
B4 — add Participant + versioned Terms + TermsAcknowledgement + Notice
B5 — implement cross-domain Listing / Room / Tenancy orchestration
B6 — freeze Wave B with runtime evidence and handoff
```

Each packet follows:

```text
write failing test
observe RED
implement only packet scope
observe focused GREEN
run typecheck
run frozen DB validators
commit
```

Do not batch B1–B5 into one implementation commit.

## 13. Handoff and Review Protocol

After the implementation plan is approved, execution receives one immutable handoff file using the current repository convention:

```text
docs/handoff/<recipient>-<YYYYMMDD-HHmmss>-wave-b-listing-tenancy-reconciliation.md
```

The handoff must include the actual recipient, creation timestamp, execution branch, baseline HEAD, mission, current state, required reading, IN/OUT scope, non-negotiable constraints, B0–B6 execution order, verification commands, STOP conditions, and completion-report format.

Review responses use:

```text
docs/handoff/reviews/<reviewer>-<YYYYMMDD-HHmmss>-wave-b-listing-tenancy-reconciliation-review.md
```

Reviewers must follow `docs/handoff/reviews/README.md` and distinguish:

```text
CONFIRMED_DEFECT
INTENTIONAL_DEVIATION
CONTEXT_MISSING
PROPOSED_IMPROVEMENT
NEEDS_OWNER_DECISION
```

A difference from the plan is not automatically a defect. A `NEEDS_OWNER_DECISION` finding is a hard stop for that decision branch.

## 14. STOP Conditions

Execution must STOP and escalate instead of inventing behavior if it encounters:

- conflict among Canonical, frozen ERDs, validated SQL, and approved Wave B spec;
- a request to define Search/Map room/property type ownership or vocabulary;
- a request to add viewing appointment, booking, reservation, future Draft Tenancy, or hold semantics;
- need to define a closed Inquiry status vocabulary not present in authority;
- need to define a new closed ListingStatusEvent actor/trigger vocabulary not present in authority;
- need to define legal validity/effect for TenancyNotice;
- need to select a participant replacement policy beyond preserving history and the one-active-PRIMARY invariant;
- need to implement proration or mid-cycle financial recomputation;
- a domain decision that would change frozen ownership, cardinality, lifecycle, or physical contract;
- unexplained test/harness failures outside the expected later-wave RED set;
- a persistence/concurrency change that belongs to the PostgreSQL lane rather than Wave B.

## 15. Downstream Contract

Wave C may begin only after Wave B is runtime-verified GREEN.

Wave C may rely on these stable outputs:

```text
Tenancy identity and lifecycle
Participant identity / optional User link
versioned Terms and effective-cycle provenance
Terms acknowledgement consistency
Room/Tenancy occupancy causality
Listing/Room vacancy causality
```

The database application-wiring gate remains blocked until the required backend reconciliation waves have landed. Wave B completion alone does not authorize Task 17 wiring of stale Finance / Incident / Trust services.

## 16. Explicit Decisions

- Wave B is domain reconciliation, not persistence implementation.
- Listing and Tenancy old contracts are replaced, not adapted.
- Cross-domain causality is explicit and command-driven.
- A narrow orchestration seam coordinates Listing / Room / Tenancy instead of introducing bidirectional service ownership.
- Checkout never auto-republishes Listing.
- Inquiry remains independent of Tenancy creation and receives no invented booking semantics.
- Opaque/non-frozen vocabularies remain opaque.
- Monetary values use an exact representation compatible with the approved persistence design.
- Final transaction/locking guarantees remain owned by the PostgreSQL persistence lane.
- Wave B ends with runtime evidence plus an immutable `docs/handoff/` transfer packet; review follows the repository handoff-review protocol.
