# Wave B Listing + Tenancy Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the CURRENT Listing/Inquiry/Tenancy boundary to Canonical v3.7 / frozen ERD semantics, make Listing and Tenancy conformance GREEN, and leave Finance/Incident/Trust for later waves without wiring persistence.

**Architecture:** Keep entity-local state and FSM logic inside focused in-memory services, and put commands that cross Listing/Room/Property/Tenancy boundaries behind a new `rental-lifecycle` orchestration module. The orchestration layer owns causal command ordering but no data; PostgreSQL transaction safety remains the database lane's responsibility and is not claimed by this wave.

**Tech Stack:** NestJS 12, TypeScript 6, Node.js 24, `node:test` via `tsx`, class-validator/class-transformer, existing in-memory services, existing ERD3 conformance tests and Python database validators.

**Spec:** `docs/superpowers/specs/2026-09-28-wave-b-listing-tenancy-reconciliation-design.md`

**Approved spec baseline:** `backend/core-foundations` after spec approval; executor must verify live HEAD before touching code.

## Global Constraints

- Authority order remains `docs/database/canonical-v3.7.md` → reviewed/frozen ERD LV1 → ERD LV2 → ERD LV3 → validated PostgreSQL/PostGIS reference DDL → implementation.
- Canonical/frozen semantics win over stale Listing/Tenancy code and tests; do not add compatibility adapters for superseded contracts.
- Wave B IN scope is Listing, ListingStatusEvent, Inquiry, Tenancy, TenancyParticipant, TenancyTerms, TermsAcknowledgement, TenancyNotice, and their Room/Property coordination only.
- Wave B OUT scope includes Finance, Payment/Deposit/Receipt/Utility, Incident/Trust/Notification, auth/resource authorization, PostgreSQL application wiring, Redis, Search ranking, saved search, viewing appointments, reservation/hold, proration, and public personal ratings.
- USER remains digital identity only; never introduce a global landlord/tenant role.
- Listing references Room only; never restore authoritative `propertyId` to Listing.
- Archived Property blocks Listing/Tenancy creation/publish below it; archived Room blocks new Listing/Tenancy creation.
- Inquiry `status`, Listing event `actorType`/`trigger`, and TenancyNotice `noticeType` remain opaque text unless frozen authority already defines exact values; do not invent closed enums/FSMs.
- Search/Map room/property type ownership/vocabulary remains OPEN; no Wave B DTO, contract, test, or default may close it.
- Participant history is append-preserving; do not invent destructive PRIMARY replacement policy.
- Terms versions are positive and unique per Tenancy but need not be contiguous.
- Terms acknowledgement is version-specific and same-Tenancy/linked-user consistent; do not invent additional acknowledgement uniqueness.
- Notice acknowledgement means viewed/acknowledged only; do not imply legal validity.
- Use exact decimal strings for `numeric(18,2)` money facts; no authoritative JavaScript floating-point money arithmetic.
- Terms calendar dates stay `YYYY-MM-DD`; do not convert authoritative calendar values through timezone-bearing `Date` objects for comparison.
- In-memory Wave B services are temporary domain scaffolding, not production persistence and not proof of concurrent transaction safety.
- Every public Room command that can leave `VACANT` must pass through Wave B orchestration so synchronous Listing invalidation cannot be bypassed.
- Do not force-push, rewrite history, or silently merge unrelated branch work.

## Review Focus

1. **Public Room bypass:** a caller using the existing `PATCH /rooms/:id/operational-state` must not be able to move a VACANT Room to MAINTENANCE/INACTIVE while a Listing remains PUBLISHED; Task B5 adds a controller-surface and runtime test for this.
2. **Exact money boundary:** `0`, `9999999999999999.99`, more-than-two decimals, negative values, and oversized numeric strings must be handled without floating-point conversion; Tasks B1 and B4 pin these cases.
3. **Archived ancestry:** Listing/Tenancy creation and Listing publish must reject archived Room/Property ancestry while preserving valid ACTIVE ancestry; Tasks B1/B3/B5 test both sides.
4. **Cross-identity acknowledgement:** Terms acknowledgement must reject cross-Tenancy participant/terms pairs, unlinked participants, and mismatched linked User IDs without mutating prior history; Task B4 pins all three.
5. **Cross-domain partial mutation:** known precondition failures during publish, Room-leaves-VACANT, activation, and checkout must fail before any entity mutation; Task B5 snapshots state before/after each rejected command.

---

## File Structure

The final Wave B implementation should converge on this responsibility map. Existing module names are retained unless the task explicitly adds a focused file.

```text
src/common/domain/
  decimal-string.ts                    # exact numeric(18,2)-compatible string validation

src/modules/listing/
  contracts/index.ts                   # Listing, ListingStatusEvent, Inquiry contracts
  dto/index.ts                         # Listing + Inquiry DTOs, no generic status patch
  services/listing.service.ts          # local Listing state/FSM/history only
  services/inquiry.service.ts          # Inquiry storage/query only; no invented FSM
  controllers/listing.controller.ts    # local read/content/unpublish/archive APIs
  controllers/inquiry.controller.ts    # Inquiry create/read APIs
  listing.module.ts                    # exports ListingService + InquiryService

src/modules/tenancy/
  contracts/index.ts                   # Tenancy/Participant/Terms/Ack/Notice contracts
  dto/index.ts                         # explicit commands, no generic status patch
  services/tenancy.service.ts          # local Tenancy state/FSM only
  services/tenancy-participant.service.ts
  services/tenancy-terms.service.ts
  services/terms-acknowledgement.service.ts
  services/tenancy-notice.service.ts
  controllers/tenancy.controller.ts    # local reads + cancel/start-ending/resume
  controllers/tenancy-support.controller.ts
  tenancy.module.ts                    # exports all Wave B tenancy services

src/modules/rental-lifecycle/
  dto/index.ts                         # cross-domain command DTOs only
  services/rental-lifecycle.coordinator.ts
  controllers/rental-lifecycle.controller.ts
  rental-lifecycle.module.ts           # imports Property/Room/Listing/Tenancy modules
  index.ts

tests/core/
  listing.behavior.test.ts
  inquiry.behavior.test.ts
  tenancy.behavior.test.ts
  tenancy-support.behavior.test.ts
  rental-lifecycle.behavior.test.ts

tests/conformance/erd3/
  listing.contract.test.ts
  tenancy.contract.test.ts
```

The implementation may preserve existing `index.ts` export barrels. Do not create a new table/module per physical table merely to mirror the database.

---

### Task B0: Capture the fresh Wave B entry baseline

**Files:**
- Create: `docs/audits/2026-09-28-wave-b-entry-baseline.md`
- Read only: current Listing/Tenancy source, conformance tests, core H6 audit, approved Wave B spec

**Interfaces:**
- Consumes: approved Wave B spec and current `backend/core-foundations` HEAD.
- Produces: observed runtime baseline with exact GREEN core gates and exact Wave B RED test names; no product-code change.

- [ ] **Step 1: Verify the live branch before execution**

Run:

```bash
git fetch origin --prune
git status --short --branch
git rev-parse HEAD
git rev-parse origin/backend/core-foundations
```

Expected: executor is on the intended Wave B execution branch/checkout based on the approved core branch, working tree clean, and any upstream divergence is understood before edits. Do not rebase/force.

- [ ] **Step 2: Run the already-GREEN predecessor gate**

Run:

```bash
pnpm exec tsx --test \
  tests/core/organization.behavior.test.ts \
  tests/core/property.behavior.test.ts \
  tests/core/room.behavior.test.ts \
  tests/conformance/erd3/identity.contract.test.ts \
  tests/conformance/erd3/organization.contract.test.ts \
  tests/conformance/erd3/property-room.lifecycle.test.ts \
  tests/conformance/erd3/future-open-boundary.static.test.ts
pnpm typecheck
python -m unittest discover -s tests/database -p "test_*.py"
```

Expected: all predecessor gates PASS. Any failure blocks Wave B and is not classified as expected Wave B RED.

- [ ] **Step 3: Capture the focused Wave B RED baseline**

Run:

```bash
pnpm exec tsx --test \
  tests/conformance/erd3/listing.contract.test.ts \
  tests/conformance/erd3/tenancy.contract.test.ts
```

Expected at entry: failures correspond only to known stale Listing/Tenancy semantics from the predecessor audit. Record exact test names and counts, not just “expected red”.

- [ ] **Step 4: Write the baseline audit**

Create `docs/audits/2026-09-28-wave-b-entry-baseline.md` with:

```text
branch + exact SHA tested
predecessor commands/results
Wave B focused command/result
exact failing Listing/Tenancy test names
known stale source facts
Finance/Incident/Trust explicitly not part of this entry gate
```

- [ ] **Step 5: Commit the observed baseline**

```bash
git add docs/audits/2026-09-28-wave-b-entry-baseline.md
git commit -m "docs: capture wave B reconciliation baseline"
```

**Exit condition:** core predecessor remains GREEN and every focused Wave B RED has a named owner in B1–B5.

---

### Task B1: Rebuild Listing contract, local lifecycle, exact public projection, and event history

**Files:**
- Create: `src/common/domain/decimal-string.ts`
- Modify: `src/modules/listing/contracts/index.ts`
- Modify: `src/modules/listing/dto/index.ts`
- Modify: `src/modules/listing/services/listing.service.ts`
- Modify: `src/modules/listing/controllers/listing.controller.ts`
- Modify: `src/modules/listing/listing.module.ts`
- Create: `tests/core/listing.behavior.test.ts`
- Strengthen: `tests/conformance/erd3/listing.contract.test.ts`
- Modify only obsolete Listing assertions in: `tests/audit/low-level-architecture/*.test.ts`

**Interfaces:**
- Produce `type DecimalString = string` and `isNumeric18Scale2NonNegative(value: string): boolean` in `src/common/domain/decimal-string.ts`.
- Produce `ListingStatus = 'draft' | 'published' | 'unpublished' | 'archived'`.
- Produce `ListingProfile { id; roomId; status; publicTitle; publicDescription; publicPriceProjection: DecimalString; publicLocationProjection: GeoPoint }` with no `propertyId`, `publishedAt`, `createdAt`, or `updatedAt` business-history fields.
- Produce `ListingStatusEvent { id; listingId; fromStatus; toStatus; reasonCode: string; actorType: string; actorUserId?: string; trigger: string; occurredAt: string; metadata?: Record<string, unknown> }`.
- `ListingService.createDraft(input: CreateListingInput): Promise<ListingProfile>` owns local creation only after caller/coordinator has established ancestry eligibility.
- `ListingService.assertCanCreateCurrent(roomId: string): Promise<void>` rejects another non-archived Listing for the Room.
- `ListingService.assertTransition(id: string, next: ListingStatus): Promise<void>` validates the frozen local FSM without mutation.
- `ListingService.transition(id: string, next: ListingStatus, event: ListingTransitionEventInput): Promise<ListingProfile>` mutates Listing and appends exactly one event.
- `ListingService.findCurrentByRoomId(roomId: string): Promise<ListingProfile | undefined>` returns the single non-archived Listing if present.
- `ListingService.findPublished(): Promise<ListingProfile[]>` has no stale `propertyId` filter.
- `ListingService.listStatusEvents(listingId: string): Promise<ListingStatusEvent[]>` returns append-only defensive copies.
- `ListingService.updateContent(id: string, input: UpdateListingContentInput): Promise<ListingProfile>` rejects ARCHIVED and does not alter status/history.

- [ ] **Step 1: Write focused Listing behavior tests before implementation**

In `tests/core/listing.behavior.test.ts`, add named tests asserting:

```text
new local draft uses DRAFT and contains roomId only as ownership reference
contract has no propertyId/hidden/rented/publishedAt/current mutable timestamps
DRAFT -> PUBLISHED, PUBLISHED -> UNPUBLISHED, UNPUBLISHED -> PUBLISHED
DRAFT -> ARCHIVED and UNPUBLISHED -> ARCHIVED
PUBLISHED -> ARCHIVED rejected
ARCHIVED is terminal and content update rejects
max one non-archived Listing per Room
archived historical Listing allows a later new current Listing
status transition appends one immutable ListingStatusEvent
prior event remains unchanged after later transitions
public query returns PUBLISHED only and exposes publicLocationProjection
public object never exposes Property operational location
money accepts "0" and "9999999999999999.99"
money rejects negative, >2 fraction digits, >16 integer digits, exponent, NaN/Infinity-like text
```

- [ ] **Step 2: Run Listing tests and prove RED**

Run:

```bash
pnpm exec tsx --test tests/core/listing.behavior.test.ts tests/conformance/erd3/listing.contract.test.ts
```

Expected: FAIL specifically on stale Listing contract/service semantics, not import/test-runner breakage.

- [ ] **Step 3: Implement exact decimal-string helper**

Implement:

```ts
export type DecimalString = string;
export function isNumeric18Scale2NonNegative(value: string): boolean;
```

Accept canonical non-negative decimal text representable by PostgreSQL `numeric(18,2)` without converting through `number`. Keep the helper about physical exactness only; do not add currency/business rounding policy.

- [ ] **Step 4: Replace Listing contracts and DTOs**

`CreateListingDto` must accept:

```ts
roomId: string;
publicTitle: string;
publicDescription: string;
publicPriceProjection: string;
publicLocationProjection: { latitude: number; longitude: number };
```

`UpdateListingDto` exposes only the mutable public projection fields. Delete `propertyId`, stale `title/description/price/locationSummary` names, and generic `UpdateListingStatusDto`.

Do not add Room/Property type fields while that vocabulary remains OPEN.

- [ ] **Step 5: Implement local Listing FSM and append-only status events**

Use the exact graph from the approved spec. Local service methods must not read Property/Room; cross-context eligibility belongs to B5. Keep event `reasonCode`, `actorType`, and `trigger` as strings, not newly invented closed enums.

- [ ] **Step 6: Restrict ListingController to local-safe surfaces**

Keep/readjust:

```text
GET /listings/public
GET /listings/:id
PATCH /listings/:id
POST /listings/:id/unpublish
POST /listings/:id/archive
```

Remove stale generic `PATCH /listings/:id/status`. Do not expose publish or create through this local controller yet; B5 will own cross-context create/publish command surfaces.

- [ ] **Step 7: Verify B1 GREEN without claiming cross-domain publish GREEN yet**

Run:

```bash
pnpm exec tsx --test tests/core/listing.behavior.test.ts
pnpm typecheck
python -m unittest discover -s tests/database -p "test_*.py"
```

Expected: all PASS. `listing.contract.test.ts` may retain only assertions explicitly owned by B5 cross-domain eligibility/invalidation.

- [ ] **Step 8: Commit B1**

```bash
git add src/common/domain/decimal-string.ts src/modules/listing tests/core/listing.behavior.test.ts tests/conformance/erd3/listing.contract.test.ts tests/audit/low-level-architecture
git commit -m "refactor: rebuild listing lifecycle and event history"
```

**Exit condition:** local Listing contract/FSM/history is frozen-correct; cross-domain create/publish/invalidation remains B5-owned.

---

### Task B2: Add Inquiry as an opaque-policy discovery bridge

**Files:**
- Modify: `src/modules/listing/contracts/index.ts`
- Modify: `src/modules/listing/dto/index.ts`
- Create: `src/modules/listing/services/inquiry.service.ts`
- Create: `src/modules/listing/controllers/inquiry.controller.ts`
- Modify: `src/modules/listing/listing.module.ts`
- Create: `tests/core/inquiry.behavior.test.ts`
- Strengthen where useful: `tests/conformance/erd3/listing.contract.test.ts`

**Interfaces:**
- Produce `Inquiry { id; listingId; senderUserId?: string; contactIntentOrMessage: string; status: string; createdAt: string }`.
- Produce `CreateInquiryDto { listingId; senderUserId?; contactIntentOrMessage; status }`; `status` remains arbitrary non-empty text and has no enum/default FSM.
- `InquiryService.create(input: CreateInquiryInput): Promise<Inquiry>` verifies referenced Listing exists, then stores the Inquiry.
- `InquiryService.findById(id: string): Promise<Inquiry>`.
- `InquiryService.findByListingId(listingId: string): Promise<Inquiry[]>`.
- Inquiry does not create, reserve, or require a Tenancy.

- [ ] **Step 1: Write Inquiry behavior tests**

Pin:

```text
linked Listing must exist
senderUserId is optional
status is stored as opaque text without enum/default transition logic
multiple inquiries may exist for one Listing
Inquiry creation does not create/mutate Tenancy or Room
no reservation/hold/viewing/realtime-message fields appear in the Inquiry contract
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
pnpm exec tsx --test tests/core/inquiry.behavior.test.ts
```

Expected: FAIL because Inquiry implementation does not yet exist.

- [ ] **Step 3: Implement Inquiry contract, DTO, service, and controller**

Expose only:

```text
POST /inquiries
GET /inquiries/:id
GET /inquiries?listingId=<id>
```

Do not add update-status commands because no closed Inquiry status lifecycle is frozen.

- [ ] **Step 4: Verify B2**

Run:

```bash
pnpm exec tsx --test tests/core/listing.behavior.test.ts tests/core/inquiry.behavior.test.ts
pnpm typecheck
python -m unittest discover -s tests/database -p "test_*.py"
```

Expected: PASS.

- [ ] **Step 5: Commit B2**

```bash
git add src/modules/listing tests/core/inquiry.behavior.test.ts tests/conformance/erd3/listing.contract.test.ts
git commit -m "feat: add inquiry discovery bridge"
```

**Exit condition:** Inquiry exists as a separate contact bridge without becoming a booking/pre-leasing subsystem.

---

### Task B3: Rebuild Tenancy core contract and local lifecycle

**Files:**
- Modify: `src/modules/tenancy/contracts/index.ts`
- Modify: `src/modules/tenancy/dto/index.ts`
- Modify: `src/modules/tenancy/services/tenancy.service.ts`
- Modify: `src/modules/tenancy/controllers/tenancy.controller.ts`
- Modify: `src/modules/tenancy/tenancy.module.ts`
- Create: `tests/core/tenancy.behavior.test.ts`
- Strengthen: `tests/conformance/erd3/tenancy.contract.test.ts`
- Modify only obsolete Tenancy assertions in: `tests/audit/low-level-architecture/*.test.ts`

**Interfaces:**
- Produce `TenancyStatus = 'draft' | 'active' | 'ending' | 'ended' | 'cancelled'`.
- Produce `TenancyEndReason = 'TERM_ENDED' | 'TENANT_INITIATED' | 'OPERATOR_INITIATED' | 'MUTUAL' | 'OTHER'`.
- Produce `TenancyProfile { id; roomId; status; startedAt?: string; endedAt?: string; endReason?: TenancyEndReason }` with no `tenantId` and no embedded `terms`.
- `TenancyService.createDraft(roomId: string): Promise<TenancyProfile>` owns local draft creation after B5 caller establishes Room/Property eligibility.
- `TenancyService.assertCanCreateForRoom(roomId: string): Promise<void>` rejects any other `draft|active|ending` Tenancy for that Room.
- `TenancyService.assertTransition(id: string, next: TenancyStatus): Promise<void>` validates local graph only.
- `TenancyService.activateLocal(id: string, occurredAt: string): Promise<TenancyProfile>` performs DRAFT→ACTIVE and records `startedAt` on first activation as the Wave B implementation convention documented below frozen semantics.
- `TenancyService.cancel(id: string): Promise<TenancyProfile>` DRAFT→CANCELLED.
- `TenancyService.startEnding(id: string): Promise<TenancyProfile>` ACTIVE→ENDING.
- `TenancyService.resumeActive(id: string): Promise<TenancyProfile>` ENDING→ACTIVE without changing original `startedAt`.
- `TenancyService.completeCheckoutLocal(id: string, endReason: TenancyEndReason, occurredAt: string): Promise<TenancyProfile>` ENDING→ENDED and records `endedAt/endReason`; B5 owns Room coupling.
- `TenancyService.findNonTerminalByRoomId(roomId: string, excludeTenancyId?: string): Promise<TenancyProfile | undefined>`.

- [ ] **Step 1: Write Tenancy behavior tests**

Pin:

```text
new local Tenancy is DRAFT and has roomId only
contract has no tenantId, embedded terms, createdAt, updatedAt
DRAFT -> ACTIVE and DRAFT -> CANCELLED
ACTIVE -> ENDING
ENDING -> ACTIVE and ENDING -> ENDED
ACTIVE -> ENDED rejected
ENDED/CANCELLED terminal
one non-terminal Tenancy per Room including ENDING
historical ENDED/CANCELLED does not block a later DRAFT
startedAt set on first activation and preserved by ENDING -> ACTIVE
endReason absent before checkout and neutral frozen value required on completion
calendar/date logic is not reintroduced into Tenancy core
```

- [ ] **Step 2: Run focused tests and prove RED**

Run:

```bash
pnpm exec tsx --test tests/core/tenancy.behavior.test.ts tests/conformance/erd3/tenancy.contract.test.ts
```

Expected: FAIL specifically on old `tenantId`/embedded terms/FSM semantics.

- [ ] **Step 3: Replace Tenancy contracts/DTOs and remove generic status patch**

Delete stale `CreateTenancyDto` money/tenant/terms fields and `UpdateTenancyStatusDto`. Local controller exposes reads and explicit local commands only:

```text
GET /tenancies
GET /tenancies/:id
POST /tenancies/:id/cancel
POST /tenancies/:id/start-ending
POST /tenancies/:id/resume
```

B5 will own create/activate/checkout because those commands read/mutate other contexts.

- [ ] **Step 4: Implement local Tenancy FSM and non-terminal guard**

Do not call Room/Property from `TenancyService`; keep local ownership clean. Do not create pre-leasing semantics for ENDING.

- [ ] **Step 5: Verify B3**

Run:

```bash
pnpm exec tsx --test tests/core/tenancy.behavior.test.ts
pnpm typecheck
python -m unittest discover -s tests/database -p "test_*.py"
```

Expected: PASS. Tenancy conformance may retain only B4/B5-owned Participant/Terms/checkout assertions.

- [ ] **Step 6: Commit B3**

```bash
git add src/modules/tenancy tests/core/tenancy.behavior.test.ts tests/conformance/erd3/tenancy.contract.test.ts tests/audit/low-level-architecture
git commit -m "refactor: rebuild tenancy lifecycle contract"
```

**Exit condition:** local Tenancy ownership/FSM is frozen-correct; participant/terms/support and Room coupling remain B4/B5.

---

### Task B4: Add Participant, versioned Terms, TermsAcknowledgement, and Notice

**Files:**
- Modify: `src/modules/tenancy/contracts/index.ts`
- Modify: `src/modules/tenancy/dto/index.ts`
- Create: `src/modules/tenancy/services/tenancy-participant.service.ts`
- Create: `src/modules/tenancy/services/tenancy-terms.service.ts`
- Create: `src/modules/tenancy/services/terms-acknowledgement.service.ts`
- Create: `src/modules/tenancy/services/tenancy-notice.service.ts`
- Create: `src/modules/tenancy/controllers/tenancy-support.controller.ts`
- Modify: `src/modules/tenancy/tenancy.module.ts`
- Create: `tests/core/tenancy-support.behavior.test.ts`
- Strengthen: `tests/conformance/erd3/tenancy.contract.test.ts`

**Interfaces:**
- `TenancyParticipant { id; tenancyId; userId?: string; role: 'PRIMARY'|'OCCUPANT'; joinedAt: string; leftAt?: string }`.
- `TenancyTerms { id; tenancyId; version: number; rentAmount: DecimalString; agreedDepositRequirement: DecimalString; termStart: string; termEnd: string; billingDayOrDueDateRule: unknown; electricityArrangement: unknown; waterArrangement: unknown; minimalRentalConditions: unknown; effectiveFromCycleBoundary: string }`.
- `TermsAcknowledgement { id; tenancyTermsId; tenancyParticipantId; userId; acknowledgedAt }`.
- `TenancyNotice { id; tenancyId; noticeType: string; issuedByUserId; contentOrNote; issuedAt; acknowledgedByUserId?: string; acknowledgedAt?: string }`.
- `TenancyParticipantService.add(input): Promise<TenancyParticipant>` rejects a second active PRIMARY for one Tenancy.
- `TenancyParticipantService.leaveOccupant(id: string, occurredAt: string): Promise<TenancyParticipant>` supports OCCUPANT history changes; it must not silently define PRIMARY replacement policy.
- `TenancyParticipantService.linkUser(id: string, userId: string): Promise<TenancyParticipant>` preserves participant identity/history.
- `TenancyParticipantService.listActiveByTenancyId(tenancyId: string): Promise<TenancyParticipant[]>`.
- `TenancyParticipantService.assertExactlyOneActivePrimary(tenancyId: string): Promise<void>`.
- `TenancyTermsService.createVersion(input): Promise<TenancyTerms>` enforces positive unique version, exact money strings, valid date ordering, and immutable prior versions; no contiguous-version assumption.
- `TenancyTermsService.findById(id: string): Promise<TenancyTerms>` and `listByTenancyId`.
- `TermsAcknowledgementService.acknowledge(input): Promise<TermsAcknowledgement>` validates same Tenancy, linked participant User, and matching userId; no invented uniqueness rule.
- `TenancyNoticeService.issue(input): Promise<TenancyNotice>` and `acknowledge(id, userId, occurredAt)`; `noticeType` opaque text and acknowledgement pair all-or-none.

- [ ] **Step 1: Write support-entity behavior tests**

Pin:

```text
participant may exist without User
PRIMARY/OCCUPANT are the only participant role values
second active PRIMARY rejects
0..N OCCUPANT accepted
OCCUPANT leave writes leftAt and preserves record
PRIMARY leave/replacement is not silently exposed by this wave
linking User does not replace participant identity/history
activation helper sees exactly one active PRIMARY
Terms version > 0 and unique per Tenancy
version 1 then 3 is allowed; contiguity not required
prior Terms object remains unchanged after later version
money exactness cases from Review Focus
termStart/termEnd/effective boundary require YYYY-MM-DD; termEnd < termStart rejects without timezone conversion
JSON arrangement/rule values remain opaque and round-trip defensively
ack same-Tenancy + linked User passes
cross-Tenancy terms/participant rejects
unlinked participant acknowledgement rejects
mismatched userId rejects
multiple acknowledgement facts are not rejected by an invented uniqueness rule
Notice type stays opaque
Notice acknowledgement writes user+timestamp together
Notice semantics contain no legal-validity flag/claim
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
pnpm exec tsx --test tests/core/tenancy-support.behavior.test.ts tests/conformance/erd3/tenancy.contract.test.ts
```

Expected: FAIL because first-class support entities/services are missing.

- [ ] **Step 3: Implement Participant service and DTOs**

Expose controlled endpoints under `tenancies/:tenancyId/participants` for add/list, occupant leave, and link-user. Do not add a PRIMARY replacement endpoint in Wave B; if product requires replacement behavior during execution, STOP for owner/domain decision rather than improvising.

- [ ] **Step 4: Implement Terms service with exact scalar rules**

Use the shared decimal-string helper from B1. Validate calendar strings without converting them to JS timestamps for ordering; ISO `YYYY-MM-DD` lexical comparison is valid after strict calendar-format validation.

Expose create/list/read version APIs; no mutable update endpoint for an existing Terms record.

- [ ] **Step 5: Implement TermsAcknowledgement consistency**

Prevalidate Terms, Participant, same Tenancy, linked User, and matching input `userId` before storing a new acknowledgement. Keep prior acknowledgement history append-only.

- [ ] **Step 6: Implement TenancyNotice service**

Require non-empty opaque `noticeType` and `contentOrNote`; issue timestamp from command/server convention. Acknowledge updates the optional pair coherently; do not add legal-effect semantics.

- [ ] **Step 7: Verify B4 focused + predecessor gates**

Run:

```bash
pnpm exec tsx --test \
  tests/core/tenancy.behavior.test.ts \
  tests/core/tenancy-support.behavior.test.ts \
  tests/conformance/erd3/tenancy.contract.test.ts
pnpm typecheck
python -m unittest discover -s tests/database -p "test_*.py"
```

Expected: Participant/Terms/Acknowledgement assertions GREEN; checkout orchestration assertion may remain B5-owned.

- [ ] **Step 8: Commit B4**

```bash
git add src/modules/tenancy tests/core/tenancy-support.behavior.test.ts tests/conformance/erd3/tenancy.contract.test.ts
git commit -m "feat: add tenancy participants terms and notices"
```

**Exit condition:** rental-relationship support facts are first-class and history-preserving without closing undefined policy.

---

### Task B5: Add cross-domain rental lifecycle orchestration and remove bypass routes

**Files:**
- Create: `src/modules/rental-lifecycle/dto/index.ts`
- Create: `src/modules/rental-lifecycle/services/rental-lifecycle.coordinator.ts`
- Create: `src/modules/rental-lifecycle/controllers/rental-lifecycle.controller.ts`
- Create: `src/modules/rental-lifecycle/rental-lifecycle.module.ts`
- Create: `src/modules/rental-lifecycle/index.ts`
- Modify: `src/app.module.ts`
- Modify: `src/modules/room/controllers/room.controller.ts`
- Modify if export needed: `src/modules/room/room.module.ts`
- Modify: `src/modules/listing/controllers/listing.controller.ts`
- Modify: `src/modules/tenancy/controllers/tenancy.controller.ts`
- Modify: `src/modules/listing/listing.module.ts`
- Modify: `src/modules/tenancy/tenancy.module.ts`
- Create: `tests/core/rental-lifecycle.behavior.test.ts`
- Finalize: `tests/conformance/erd3/listing.contract.test.ts`
- Finalize: `tests/conformance/erd3/tenancy.contract.test.ts`
- Modify only obsolete orchestration assertions in: `tests/audit/low-level-architecture/*.test.ts`

**Interfaces:**
- `RentalLifecycleCoordinator.createListing(dto: CreateListingDto): Promise<ListingProfile>` validates active Room + active Property and single-current invariant, but does not require VACANT until publish.
- `publishListing(listingId: string, context: ListingCommandContext): Promise<ListingProfile>` validates DRAFT/UNPUBLISHED + VACANT active Room + active Property, then transitions with an event.
- `transitionRoomManually(roomId: string, next: 'vacant'|'maintenance'|'inactive', context: ListingCommandContext): Promise<RoomProfile>` synchronously unpublishes current PUBLISHED Listing before a valid VACANT→MAINTENANCE/INACTIVE transition; it leaves non-VACANT→... behavior consistent with the frozen Room FSM.
- `createTenancy(roomId: string): Promise<TenancyProfile>` validates active Room + active parent Property + no non-terminal Tenancy, then creates DRAFT; operational vacancy is not a creation requirement.
- `activateTenancy(tenancyId: string, context: ListingCommandContext, occurredAt: string): Promise<TenancyProfile>` prevalidates DRAFT, active/VACANT Room, active Property, no competing non-terminal Tenancy, exactly one active PRIMARY; synchronously unpublishes PUBLISHED Listing if present, activates Tenancy, and transitions Room VACANT→OCCUPIED with cause `tenancy_activated`.
- `checkoutTenancy(tenancyId: string, endReason: TenancyEndReason, occurredAt: string): Promise<TenancyProfile>` prevalidates ENDING + OCCUPIED matching Room, completes Tenancy, transitions Room OCCUPIED→VACANT with `checkout_confirmed`, and does not republish Listing.
- `archiveRoomWithListings(...)` is **not** introduced unless needed by an already-authorized Room archive entry point; Wave B only supplies `ListingService.archiveAllForRoom(...)` as the Listing-side capability for later authoritative orchestration.
- Cross-domain command context carries only event facts already required by the Listing event contract; it must not define new role/authorization policy.

- [ ] **Step 1: Write cross-domain behavior tests before coordinator implementation**

Cover at minimum:

```text
create Listing under active Room/Property passes
create Listing under archived Room rejects with no Listing mutation
create Listing under archived Property rejects with no Listing mutation
publish requires DRAFT/UNPUBLISHED + VACANT active Room + active Property
publish under maintenance/inactive/occupied Room rejects with no Listing/event mutation
publish under archived Room/Property rejects
manual VACANT -> MAINTENANCE synchronously unpublishes PUBLISHED Listing and writes ROOM_MAINTENANCE event
manual VACANT -> INACTIVE synchronously unpublishes with ROOM_INACTIVE event
public HTTP Room operational-state route cannot bypass coordinator
create Tenancy under active ancestry passes even if Room is not VACANT, when no non-terminal Tenancy exists
create Tenancy under archived Room/Property rejects with no Tenancy mutation
ENDING blocks next DRAFT
activation requires exactly one active PRIMARY
activation under non-VACANT/archived ancestry rejects before Listing/Tenancy/Room mutation
activation unpublishes current PUBLISHED Listing with ROOM_OCCUPIED before resulting OCCUPIED state
activation changes DRAFT->ACTIVE and VACANT->OCCUPIED
checkout requires ENDING + OCCUPIED matching Room
checkout rejection leaves Tenancy/Room unchanged
checkout sets ENDED + endedAt/endReason and Room VACANT
checkout leaves old Listing UNPUBLISHED; no auto-republish
all known rejected commands leave snapshots of all touched in-memory entities unchanged
```

- [ ] **Step 2: Run tests and prove RED**

Run:

```bash
pnpm exec tsx --test tests/core/rental-lifecycle.behavior.test.ts
```

Expected: FAIL because orchestration module does not yet exist and current Room route bypasses Listing invalidation.

- [ ] **Step 3: Implement the coordinator with prevalidation-before-mutation**

For every command, complete all deterministic local preconditions before the first mutation. Use local service assert/query methods from B1/B3/B4. Do not add Redis locks, DB transactions, retry loops, or concurrency claims.

- [ ] **Step 4: Expose explicit cross-domain command routes**

`RentalLifecycleController` uses root controller routing and exposes:

```text
POST  /listings                 -> createListing
POST  /listings/:id/publish     -> publishListing
PATCH /rooms/:id/operational-state -> transitionRoomManually
POST  /tenancies                -> createTenancy
POST  /tenancies/:id/activate   -> activateTenancy
POST  /tenancies/:id/checkout   -> checkoutTenancy
```

Keep Listing local `unpublish/archive` and Tenancy local `cancel/start-ending/resume` on their entity controllers.

- [ ] **Step 5: Remove bypassing routes from entity controllers**

Remove `RoomController.updateOperationalState` from the Room controller once the exact same public route is owned by `RentalLifecycleController`. Ensure no second public route can call `RoomService.transitionOperationalState(..., 'manual')` directly.

Ensure stale Listing/Tenancy generic status patch routes remain absent.

- [ ] **Step 6: Add Listing-side Room archive capability without inventing client blockers**

Implement:

```ts
ListingService.archiveAllForRoom(
  roomId: string,
  eventFactory: (listing: ListingProfile) => ListingTransitionEventInput,
): Promise<ListingProfile[]>;
```

It archives DRAFT/UNPUBLISHED current Listings through legal local transitions and records history. A PUBLISHED Listing must be explicitly unpublished first by the authoritative archive workflow; do not silently invent PUBLISHED→ARCHIVED, which is absent from the frozen graph.

Do not add an HTTP route that accepts “archive blockers are clear” as client truth.

- [ ] **Step 7: Make Listing and Tenancy conformance fully GREEN**

Run:

```bash
pnpm exec tsx --test \
  tests/conformance/erd3/listing.contract.test.ts \
  tests/conformance/erd3/tenancy.contract.test.ts
```

Expected: all Listing and Tenancy Wave B assertions PASS.

- [ ] **Step 8: Run focused Wave B + predecessor regression gate**

Run:

```bash
pnpm exec tsx --test \
  tests/core/organization.behavior.test.ts \
  tests/core/property.behavior.test.ts \
  tests/core/room.behavior.test.ts \
  tests/core/listing.behavior.test.ts \
  tests/core/inquiry.behavior.test.ts \
  tests/core/tenancy.behavior.test.ts \
  tests/core/tenancy-support.behavior.test.ts \
  tests/core/rental-lifecycle.behavior.test.ts \
  tests/conformance/erd3/identity.contract.test.ts \
  tests/conformance/erd3/organization.contract.test.ts \
  tests/conformance/erd3/property-room.lifecycle.test.ts \
  tests/conformance/erd3/listing.contract.test.ts \
  tests/conformance/erd3/tenancy.contract.test.ts \
  tests/conformance/erd3/future-open-boundary.static.test.ts
pnpm typecheck
python -m unittest discover -s tests/database -p "test_*.py"
```

Expected: all listed tests and validators PASS.

- [ ] **Step 9: Commit B5**

```bash
git add src/modules/rental-lifecycle src/app.module.ts src/modules/room src/modules/listing src/modules/tenancy tests/core/rental-lifecycle.behavior.test.ts tests/conformance/erd3 tests/audit/low-level-architecture
git commit -m "feat: coordinate listing room and tenancy lifecycle"
```

**Exit condition:** no current public command can violate Listing↔Room/Tenancy↔Room causal invariants in the in-memory backend; both Wave B conformance files are GREEN.

---

### Task B6: Freeze Wave B runtime evidence and prepare the next handoff boundary

**Files:**
- Create: `docs/audits/2026-09-28-wave-b-completion.md`
- Modify only if observed evidence requires clarification: `tests/conformance/erd3/README.md`
- Modify only if implementation paths changed intentionally: Listing/Tenancy `README.md` / `ARCHITECTURE.md`
- No product code unless verification reveals a regression; return to the owning B1–B5 task instead of patching during freeze.

**Interfaces:**
- Consumes: B1–B5 completed implementation.
- Produces: fresh runtime evidence showing Wave B GREEN and classifying remaining RED exactly as Wave C/D ownership.

- [ ] **Step 1: Run focused Wave B gate**

Run the complete command from B5 Step 8.

Expected: PASS.

- [ ] **Step 2: Run full ERD3 conformance**

Run:

```bash
pnpm test:conformance:erd3
```

Expected:

```text
GREEN: authority, identity, organization, property/room, listing, tenancy, future-runtime boundary
EXPECTED RED only: Finance (Wave C), Incident/Trust (Wave D)
```

Any Listing/Tenancy failure blocks completion. Any new failure outside named later waves must be investigated rather than relabeled expected.

- [ ] **Step 3: Run full repository tests**

Run:

```bash
pnpm test
```

Expected: rebuilt/current semantics pass. Any remaining failures must map exactly to named Wave C/D stale semantics or obsolete tests whose replacement is explicitly part of those later waves. Import/syntax/harness failures are never expected RED.

- [ ] **Step 4: Re-run hard engineering gates**

Run:

```bash
pnpm typecheck
python -m unittest discover -s tests/database -p "test_*.py"
pnpm exec tsx --test src/integrations/google-identity/google-id-token-verifier.spec.ts
```

Expected: all PASS.

- [ ] **Step 5: Write completion audit**

`docs/audits/2026-09-28-wave-b-completion.md` records:

```text
exact SHA tested
all commands + observed counts/results
GREEN boundary matrix
exact remaining RED test names grouped into Wave C and Wave D
intentional deviations from this plan with evidence, if any
OPEN policies encountered and left unresolved
statement that persistence/concurrency remains unclaimed
```

- [ ] **Step 6: Verify no OPEN/FUTURE leakage**

Search source/tests touched by Wave B for accidental additions of:

```text
global business role
room/property type enum
reservation / hold / viewing appointment
proration
Inquiry status enum/FSM
noticeType enum
closed actorType/trigger enum
participant PRIMARY destructive replacement
PostgreSQL/Redis imports in domain services
```

Expected: no unauthorized semantics.

- [ ] **Step 7: Commit B6 evidence**

```bash
git add docs/audits/2026-09-28-wave-b-completion.md tests/conformance/erd3/README.md src/modules/listing/README.md src/modules/listing/ARCHITECTURE.md src/modules/tenancy/README.md src/modules/tenancy/ARCHITECTURE.md
git commit -m "docs: freeze wave B reconciliation evidence"
```

Only add files that actually changed.

**Wave B exit condition:** Listing/Tenancy are runtime-verified GREEN, predecessor core stays GREEN, remaining RED is only named Wave C/D scope, and no persistence/OPEN policy has been silently introduced.

---

## Execution / Review Rules

- Execute B0 → B6 in order. Do not batch B1–B5 into one large change.
- Each code task uses TDD: failing focused test → minimal implementation → focused PASS → typecheck/validators → commit.
- One logical commit per packet is preferred; if mechanical splits are necessary, keep them contiguous and label them with the packet purpose.
- A reviewer may reject one packet without invalidating already-frozen predecessor packets.
- If implementation differs from this plan, use `docs/handoff/reviews/README.md`: distinguish `CONFIRMED_DEFECT`, `INTENTIONAL_DEVIATION`, `CONTEXT_MISSING`, `PROPOSED_IMPROVEMENT`, and `NEEDS_OWNER_DECISION`.
- `NEEDS_OWNER_DECISION` is a hard stop for that branch of work.
- Do not report PASS from source inspection; runtime evidence is mandatory.

## STOP Conditions

STOP and report rather than choose silently if execution encounters:

```text
authority/spec contradiction
need to define Search/Map room/property type ownership or vocabulary
need to define Inquiry closed statuses
need to define Listing actorType/trigger closed vocabulary
need to define Notice type closed vocabulary
need to define PRIMARY replacement product policy
need to introduce booking/reservation/hold/viewing semantics
need to introduce finance/proration behavior
need to wire production PostgreSQL/Redis in Wave B
unexpected predecessor core regression
unknown full-suite RED that does not map to Wave C/D
architecture change outside the approved coordinator boundary
```

## Completion Handoff

After B6 is GREEN, create a fresh immutable handoff using the repository convention:

```text
docs/handoff/<recipient>-<YYYYMMDD-HHmmss>-wave-b-listing-tenancy-reconciliation.md
```

Use `docs/handoff/README.md` and `docs/handoff/reviews/README.md`. The handoff must record the actual final branch and SHA, runtime verification results, intentional deviations, unresolved owner decisions, and next dependency: Wave C Finance first; database application wiring remains gated until the later backend reconciliation waves required by its Task 17 have landed.
