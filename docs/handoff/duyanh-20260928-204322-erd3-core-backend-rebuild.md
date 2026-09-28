# AGENT HANDOFF — ERD3 Core Backend Rebuild

> **Audience:** implementation agent taking over `backend/core-foundations` with no chat history.
>
> **Execution mode:** read this file, verify the repository state, then implement the packets below **in order**. Do not redesign the product. Do not skip RED/GREEN gates. Do not continue past a STOP condition.

## 0. Mission

Finish the **ERD3 core backend rebuild** for TrọƠi so the current NestJS in-memory domain layer conforms to Canonical v3.7 for:

```text
Identity
Organization
Property
Room
CURRENT runtime module registration
```

This handoff intentionally stops before Listing/Tenancy/Finance/Incident/Trust implementation and before production persistence/migrations.

The immediate execution entry point is **H0 — split the mixed Identity/Organization conformance gate**.

Do **not** jump directly into Organization code.

---

## 1. Repository / branch state

Repository:

```text
onsra520/TroOi-Project
```

Target branch:

```text
backend/core-foundations
```

Baseline immediately before this root handoff file was added:

```text
7cdbaba98751cbf5e6547e2f0eccc9fc99f43471
```

That baseline commit only added the detailed handoff plan. Verify the current branch HEAD before editing because this handoff document commit is newer and other agents may have advanced the branch.

Read recent commits before implementation:

```bash
git status
git branch --show-current
git log --oneline -15
```

Expected branch:

```text
backend/core-foundations
```

If the branch is different, **STOP** and switch/resolve before implementation.

---

## 2. Mandatory reading order

Read these files before changing code:

```text
1. docs/handoff/duyanh-20260928-204322-erd3-core-backend-rebuild.md    ← this file
2. docs/database/canonical-v3.7.md             ← highest product/domain authority
3. docs/database/erd/README.md
4. docs/database/erd/trooi-erd-lv1-conceptual.json
5. docs/database/erd/trooi-erd-lv2-logical.json
6. docs/database/erd/trooi-erd-lv3-physical.json
7. docs/database/schema/trooi-schema-lv3.sql
8. docs/superpowers/specs/2026-09-28-erd3-backend-reconciliation-design.md
9. docs/superpowers/plans/2026-09-28-erd3-core-backend-rebuild.md
10. docs/superpowers/plans/2026-09-28-erd3-core-rebuild-handoff.md
11. docs/audits/2026-09-28-erd3-conformance-red-baseline.md
```

Authority order is:

```text
Canonical v3.7
  > ERD LV1
  > ERD LV2
  > ERD LV3
  > validated PostgreSQL/PostGIS DDL
  > project/module docs
  > implementation/tests
```

If lower-level code/tests/docs disagree with a frozen invariant, change the lower level. **Do not weaken ERD3 to preserve old code.**

---

## 3. What has already been done

### Documentation / authority

Repository and module documentation has already been aligned to ERD3 authority. `docs/SYSTEM_STRUCTURE_IMPLEMENTATION.md` is historical/superseded rather than current authority.

### Conformance harness

Existing conformance suite:

```text
tests/conformance/erd3/authority.static.test.ts
tests/conformance/erd3/identity-organization.contract.test.ts
tests/conformance/erd3/property-room.lifecycle.test.ts
tests/conformance/erd3/listing.contract.test.ts
tests/conformance/erd3/tenancy.contract.test.ts
tests/conformance/erd3/finance.contract.test.ts
tests/conformance/erd3/incident.contract.test.ts
tests/conformance/erd3/trust.contract.test.ts
tests/conformance/erd3/future-open-boundary.static.test.ts
```

`pnpm test:conformance:erd3` is intentionally RED while unrebuilt domains remain.

### Identity implementation

Identity has already been rebuilt to remove the invalid global business role model:

```text
UserRole removed
UserProfile.role removed
role-assignment Invitation contracts removed
role-assignment invitation routes/services removed
Google identity flow retained
```

Relevant current files:

```text
src/modules/identity-access/contracts/index.ts
src/modules/identity-access/dto/index.ts
src/modules/identity-access/services/identity-access.service.ts
src/modules/identity-access/controllers/identity-access.controller.ts
```

### Known execution defect

`tests/conformance/erd3/identity-organization.contract.test.ts` currently mixes:

```text
already-rebuilt Identity assertions
+
still-RED Organization assertions
```

CI currently treats that mixed file as a focused hard gate.

Therefore the first implementation action is H0: **split the file into independent Identity and Organization gates**.

---

## 4. Non-negotiable domain constraints

### USER / access

```text
USER = digital identity only
```

Never reintroduce a global scalar business role such as:

```text
owner
operator
tenant
platform_admin
```

Business access later derives from resource relationships, not `USER.role`.

### ORGANIZATION

MVP Organization is the rental operating workspace and has exactly one:

```text
primaryOwnerUserId
```

Do not invent current staff/team/member/delegation semantics. Those are FUTURE.

### PROPERTY

Lifecycle is exactly:

```text
active | archived
```

Property owns separate:

```text
operationalAddressText
operationalLocation
publicLocationProjection
```

Archive is a guarded command, not a generic writable status.

### ROOM

Room owns two independent dimensions:

```text
operationalState = vacant | occupied | maintenance | inactive
recordLifecycle = active | archived
```

Room does **not** own agreed rent/base rent truth.

Allowed operational transitions:

```text
manual:
  vacant      -> maintenance | inactive
  maintenance -> vacant | inactive
  inactive    -> vacant

tenancy_activated:
  vacant      -> occupied

checkout_confirmed:
  occupied    -> vacant
```

Forbidden examples:

```text
manual vacant -> occupied
manual occupied -> vacant
occupied -> maintenance
occupied -> inactive
```

Archived Room rejects all operational transitions.

Room archive requires:

```text
operationalState == inactive
hasNonTerminalTenancy == false
hasOpenIncident == false
```

Archived Property blocks:

```text
new Room creation
inactive Room reactivation to vacant
```

### CURRENT vs FUTURE

These are **not CURRENT** and must not be added during this handoff:

```text
Subscription / Pricing / Quota
CSV / Excel import
advanced team/staff/delegation
partner marketplace / worker dispatch
AI / OCR / predictive features
full realtime messaging
saved search / advanced favorites
payment gateway dependency
OTA / instant booking
proration
public personal landlord/tenant rating
```

Also do not invent these previously discussed product features unless authority is explicitly updated first:

```text
Viewing Appointment / viewing schedule
favorites/bookmarks as a frozen CURRENT domain feature
reservation / availability hold
"giữ giá 24 giờ"
```

If one of those becomes required, **STOP backend implementation** and update authority top-down first:

```text
Canonical -> LV1 -> LV2 -> LV3 -> SQL -> docs/use-cases -> conformance -> backend
```

---

## 5. Test discipline

Use TDD for every packet:

```text
1. Write/strengthen focused test.
2. Run it and observe semantic RED.
3. Implement minimum domain change.
4. Run focused test and observe GREEN.
5. Run pnpm typecheck.
6. Run frozen DB validators.
7. Run relevant regression tests.
8. Commit packet.
9. Continue only when packet exit condition is satisfied.
```

A valid expected RED is a business assertion failure.

The following are **not acceptable expected RED**:

```text
TypeScript syntax error
module/import failure
bad test path
broken test harness
unexpected runtime exception unrelated to the asserted invariant
unknown regression
```

Database authority validators must remain unchanged and GREEN:

```bash
python -m unittest discover -s tests/database -p "test_*.py"
```

---

# IMPLEMENTATION PACKETS

## H0 — Split Identity and Organization conformance gates

### Goal

Make Identity independently provable GREEN while Organization remains intentionally RED.

### Files

Create:

```text
tests/conformance/erd3/identity.contract.test.ts
tests/conformance/erd3/organization.contract.test.ts
```

Delete after moving all assertions:

```text
tests/conformance/erd3/identity-organization.contract.test.ts
```

Modify:

```text
.github/workflows/backend-erd3-conformance.yml
docs/superpowers/plans/2026-09-28-erd3-core-backend-rebuild.md
tests/conformance/erd3/README.md   # only if it references the mixed file
```

### Required split

`identity.contract.test.ts` owns only:

```text
USER contract has no global business role
```

It must inspect:

```text
src/modules/identity-access/contracts/index.ts
src/modules/identity-access/dto/index.ts
src/modules/identity-access/services/identity-access.service.ts
src/modules/identity-access/controllers/identity-access.controller.ts
```

and reject:

```text
UserRole
role: / role?:
owner|operator|tenant|platform_admin role literals
CreateInvitationDto
AcceptInvitationDto
identity-access/invitations surfaces
```

`organization.contract.test.ts` owns:

```text
Organization contract carries primaryOwnerUserId
OrganizationStatus is not current ERD3 source truth
```

### Before change

Run:

```bash
pnpm exec tsx --test tests/conformance/erd3/identity-organization.contract.test.ts
```

Confirm Identity assertion is not the reason for failure. If Identity is broken, fix/reconcile Identity first.

### After split

Run:

```bash
pnpm exec tsx --test tests/conformance/erd3/identity.contract.test.ts
pnpm exec tsx --test tests/conformance/erd3/organization.contract.test.ts
pnpm typecheck
python -m unittest discover -s tests/database -p "test_*.py"
```

Expected:

```text
Identity      PASS
Organization  RED
Typecheck     PASS
DB validators PASS
```

### CI change

Replace focused CI step:

```text
identity-organization.contract.test.ts
```

with:

```text
identity.contract.test.ts
```

Do not make Organization a hard focused CI gate until H2 is complete.

### Commit

```bash
git add .github/workflows/backend-erd3-conformance.yml \
  tests/conformance/erd3 \
  docs/superpowers/plans/2026-09-28-erd3-core-backend-rebuild.md

git commit -m "test: split identity handoff gate from organization red baseline"
```

### Exit condition

```text
Identity independently GREEN.
Organization independently RED for semantic reasons.
Typecheck GREEN.
DB validators GREEN.
```

---

## H1 — Freeze Identity with fresh runtime evidence

### Goal

Record a trustworthy Identity completion point. Do not add Organization behavior here.

### Commands

```bash
pnpm exec tsx --test tests/conformance/erd3/identity.contract.test.ts
pnpm exec tsx --test src/integrations/google-identity/google-id-token-verifier.spec.ts
pnpm typecheck
python -m unittest discover -s tests/database -p "test_*.py"
pnpm test:conformance:erd3
```

If the direct Google verifier command is incompatible with repository test discovery, use the repository test command that actually runs the file and record that exact command.

### Expected

```text
Identity conformance PASS
Google identity regression PASS
Typecheck PASS
DB validators PASS
Full ERD3 still RED only for not-yet-rebuilt boundaries
```

### Audit update

Update:

```text
docs/audits/2026-09-28-erd3-conformance-red-baseline.md
```

Record actual:

```text
commit SHA tested
commands
PASS/FAIL result
exact remaining failing test names
CI run/artifact reference when available
```

Never write “PASS” from source inspection only.

### Commit

```bash
git add docs/audits/2026-09-28-erd3-conformance-red-baseline.md
git commit -m "docs: freeze identity ERD3 runtime evidence"
```

### Exit condition

Identity is frozen GREEN and every remaining RED has a named owner.

---

## H2 — Rebuild Organization

### Files

Modify:

```text
src/modules/organization/contracts/index.ts
src/modules/organization/dto/index.ts
src/modules/organization/services/organization.service.ts
src/modules/organization/controllers/organization.controller.ts
```

Create:

```text
tests/core/organization.behavior.test.ts
```

Update only obsolete Organization assertions under:

```text
tests/audit/low-level-architecture/
```

### Target contract

```ts
export interface OrganizationProfile {
  id: string;
  name: string;
  primaryOwnerUserId: string;
  createdAt: string;
  updatedAt: string;
}
```

Create DTO:

```text
name
primaryOwnerUserId
```

Update DTO:

```text
name?
```

Remove:

```text
OrganizationStatus
description
generic owner mutation
generic lifecycle/status mutation
```

Do not add staff/member/delegation/invitation replacement.

### RED tests

`tests/core/organization.behavior.test.ts` must cover:

```text
create stores primaryOwnerUserId
update can rename
untyped extra primaryOwnerUserId cannot replace owner
returned profile has no status
returned profile has no description
still-valid list/find engineering behavior remains intact
```

Run RED:

```bash
pnpm exec tsx --test \
  tests/core/organization.behavior.test.ts \
  tests/conformance/erd3/organization.contract.test.ts
```

### GREEN gate

```bash
pnpm exec tsx --test \
  tests/conformance/erd3/identity.contract.test.ts \
  tests/conformance/erd3/organization.contract.test.ts \
  tests/core/organization.behavior.test.ts
pnpm typecheck
python -m unittest discover -s tests/database -p "test_*.py"
```

Expected: all PASS.

### Commit

```bash
git add src/modules/organization \
  tests/core/organization.behavior.test.ts \
  tests/conformance/erd3/organization.contract.test.ts \
  tests/audit/low-level-architecture

git commit -m "refactor: align organization ownership with ERD3"
```

### Exit condition

Identity + Organization GREEN. Property/Room untouched.

---

## H3 — Rebuild Property

### Files

Modify:

```text
src/modules/property/contracts/index.ts
src/modules/property/dto/index.ts
src/modules/property/services/property.service.ts
src/modules/property/controllers/property.controller.ts
```

Create:

```text
tests/core/property.behavior.test.ts
```

Strengthen:

```text
tests/conformance/erd3/property-room.lifecycle.test.ts
```

### Target contract

```ts
export type PropertyLifecycle = 'active' | 'archived';

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface PropertyProfile {
  id: string;
  organizationId: string;
  name: string;
  lifecycleStatus: PropertyLifecycle;
  operationalAddressText: string;
  operationalLocation: GeoPoint;
  publicLocationProjection: GeoPoint;
  createdAt: string;
  updatedAt: string;
}

export interface PropertyArchiveBlockers {
  hasNonTerminalTenancy: boolean;
  hasPublishedListing: boolean;
  hasOccupiedRoom: boolean;
  hasNonInactiveOrArchivedRoom: boolean;
  hasOpenIncident: boolean;
}
```

DTO validation:

```text
latitude  [-90, 90]
longitude [-180, 180]
```

### Important boundary

`PropertyArchiveBlockers` is an **internal service seam only**.

Do not expose an HTTP route where the client sends blocker booleans and the server trusts them as authoritative facts.

### Behavior tests

Cover:

```text
new property starts active
operational/public locations are independent
update public projection does not overwrite operational location
coordinate validation
archive rejects each blocker independently
archive succeeds only when all blockers false
archived is terminal
update cannot change lifecycle/unarchive
client DTO contains no archive-blocker truth fields
```

### RED

```bash
pnpm exec tsx --test \
  tests/core/property.behavior.test.ts \
  tests/conformance/erd3/property-room.lifecycle.test.ts
```

Separate Property failures from still-expected Room failures.

### GREEN gate

```bash
pnpm exec tsx --test tests/core/property.behavior.test.ts
pnpm exec tsx --test \
  tests/conformance/erd3/identity.contract.test.ts \
  tests/conformance/erd3/organization.contract.test.ts
pnpm typecheck
python -m unittest discover -s tests/database -p "test_*.py"
pnpm exec tsx --test tests/conformance/erd3/property-room.lifecycle.test.ts
```

Expected at end H3:

```text
Property-owned assertions GREEN
Room-owned assertions may remain RED
```

### Commit

```bash
git add src/modules/property \
  tests/core/property.behavior.test.ts \
  tests/conformance/erd3/property-room.lifecycle.test.ts \
  tests/audit/low-level-architecture

git commit -m "refactor: align property lifecycle and location with ERD3"
```

---

## H4 — Rebuild Room

### Files

Modify:

```text
src/modules/room/contracts/index.ts
src/modules/room/dto/index.ts
src/modules/room/services/room.service.ts
src/modules/room/controllers/room.controller.ts
```

Create:

```text
tests/core/room.behavior.test.ts
```

Strengthen/convert:

```text
tests/conformance/erd3/property-room.lifecycle.test.ts
```

### Target contract

```ts
export type RoomOperationalState =
  | 'vacant'
  | 'occupied'
  | 'maintenance'
  | 'inactive';

export type RoomRecordLifecycle = 'active' | 'archived';

export type RoomOperationalTransitionCause =
  | 'manual'
  | 'tenancy_activated'
  | 'checkout_confirmed';

export interface RoomProfile {
  id: string;
  propertyId: string;
  nameOrLabel: string;
  operationalState: RoomOperationalState;
  recordLifecycle: RoomRecordLifecycle;
  createdAt: string;
  updatedAt: string;
}

export interface RoomArchiveBlockers {
  hasNonTerminalTenancy: boolean;
  hasOpenIncident: boolean;
}
```

Remove current-authority fields/contracts that preserve old semantics:

```text
RoomStatus
basePrice
rent
area
maxOccupants
archived as operational status
```

### FSM

Implement exactly:

```text
manual:
  vacant      -> maintenance | inactive
  maintenance -> vacant | inactive
  inactive    -> vacant

tenancy_activated:
  vacant      -> occupied

checkout_confirmed:
  occupied    -> vacant
```

Everything else rejects.

### Parent guard

Use `PropertyService` as current in-memory authority for parent lifecycle.

Reject:

```text
Room create under archived Property
inactive -> vacant when parent Property archived
```

Do not cache Property lifecycle truth inside Room.

### Archive guard

Require:

```text
operationalState == inactive
hasNonTerminalTenancy == false
hasOpenIncident == false
```

Then set:

```text
recordLifecycle = archived
```

Archived Room rejects all operational transitions.

### Controller

Replace stale generic status route with:

```text
PATCH /rooms/:id/operational-state
```

HTTP/manual mutation may target only:

```text
vacant
maintenance
inactive
```

Controller always uses cause:

```text
manual
```

A client must not directly submit:

```text
tenancy_activated
checkout_confirmed
```

### RED behavior coverage

Cover all of:

```text
new room vacant + active
no room-owned rent/basePrice/area/maxOccupants truth
all manual transitions above
vacant->occupied manual rejected
vacant->occupied tenancy_activated accepted
occupied->vacant manual rejected
occupied->vacant checkout_confirmed accepted
occupied->maintenance rejected for every cause
occupied->inactive rejected for every cause
archive not an operational state
archive requires inactive
archive blockers enforced
eligible archive sets recordLifecycle archived
archived room rejects all operational transitions
archived parent blocks create
archived parent blocks inactive->vacant
HTTP cannot impersonate tenancy/check-out causes
```

### RED

```bash
pnpm exec tsx --test \
  tests/core/room.behavior.test.ts \
  tests/conformance/erd3/property-room.lifecycle.test.ts
```

### GREEN gate

```bash
pnpm exec tsx --test \
  tests/core/organization.behavior.test.ts \
  tests/core/property.behavior.test.ts \
  tests/core/room.behavior.test.ts \
  tests/conformance/erd3/identity.contract.test.ts \
  tests/conformance/erd3/organization.contract.test.ts \
  tests/conformance/erd3/property-room.lifecycle.test.ts
pnpm typecheck
python -m unittest discover -s tests/database -p "test_*.py"
```

Expected: all PASS.

### Commit

```bash
git add src/modules/room \
  tests/core/room.behavior.test.ts \
  tests/conformance/erd3/property-room.lifecycle.test.ts \
  tests/audit/low-level-architecture

git commit -m "refactor: rebuild room lifecycle for ERD3"
```

---

## H5 — Remove FUTURE modules from CURRENT runtime

### Goal

Current `AppModule` must not advertise FUTURE capabilities as active core behavior.

### Files

Modify:

```text
src/app.module.ts
tests/conformance/erd3/future-open-boundary.static.test.ts
```

Update only obsolete registration assertions in:

```text
tests/audit/low-level-architecture/
```

### Required runtime result

`AppModule` must not register:

```text
SubscriptionModule
OnboardingModule
```

The source directories may remain dormant scaffolding. Do not delete them merely to satisfy this gate.

Manual Organization/Property/Room APIs remain current.

### RED

Strengthen the static test, then run:

```bash
pnpm exec tsx --test tests/conformance/erd3/future-open-boundary.static.test.ts
```

Expected before implementation: FAIL while stale registrations remain.

### GREEN gate

```bash
pnpm exec tsx --test tests/conformance/erd3/future-open-boundary.static.test.ts
pnpm typecheck
python -m unittest discover -s tests/database -p "test_*.py"
```

Expected: all PASS.

### Commit

```bash
git add src/app.module.ts \
  tests/conformance/erd3/future-open-boundary.static.test.ts \
  tests/audit/low-level-architecture

git commit -m "refactor: remove future modules from current runtime"
```

---

## H6 — Core-stage freeze / final handoff evidence

Do not add new product behavior in H6.

### Focused core gate

```bash
pnpm exec tsx --test \
  tests/core/organization.behavior.test.ts \
  tests/core/property.behavior.test.ts \
  tests/core/room.behavior.test.ts \
  tests/conformance/erd3/identity.contract.test.ts \
  tests/conformance/erd3/organization.contract.test.ts \
  tests/conformance/erd3/property-room.lifecycle.test.ts \
  tests/conformance/erd3/future-open-boundary.static.test.ts
```

Expected:

```text
PASS
```

### Compile

```bash
pnpm typecheck
```

Expected: PASS.

### Database authority

```bash
python -m unittest discover -s tests/database -p "test_*.py"
```

Expected: PASS.

### Full ERD3 classification

```bash
pnpm test:conformance:erd3
```

Expected after H6:

```text
GREEN:
  authority
  identity
  organization
  property/room
  FUTURE runtime boundary

RED only because not rebuilt yet:
  listing
  tenancy
  finance
  incident
  trust
```

Do not accept any other RED without identifying the exact test and proving it belongs to an approved later wave.

### Full repository tests

```bash
pnpm test
```

There must be:

```text
no syntax errors
no import errors
no harness errors
no unexplained regressions in rebuilt core
```

Remaining failures must be named individually in the audit.

### Audit

Update:

```text
docs/audits/2026-09-28-erd3-conformance-red-baseline.md
```

For each boundary record:

```text
PASS | EXPECTED RED | BLOCKED
exact command
commit SHA tested
exact test names
CI run / artifact reference when available
next-wave owner for every expected RED
```

### Commit

```bash
git add docs/audits/2026-09-28-erd3-conformance-red-baseline.md \
  tests/conformance/erd3/README.md

git commit -m "docs: freeze ERD3 core rebuild handoff evidence"
```

### H6 exit condition

Core rebuild is complete only when:

```text
[PASS] Identity independent hard gate
[PASS] no global USER business role/invitation role surface
[PASS] Google identity regression
[PASS] Organization primaryOwnerUserId semantics
[PASS] Property lifecycle/location semantics
[PASS] Room dual-state/FSM/archive/parent semantics
[PASS] FUTURE modules absent from CURRENT AppModule
[PASS] focused core tests
[PASS] focused core conformance
[PASS] pnpm typecheck
[PASS] frozen DB validators
[EXPECTED RED, NAMED] Listing/Tenancy/Finance/Incident/Trust only
[NOT STARTED] production persistence/migrations/concurrency hardening
```

---

# 6. STOP / ESCALATION CONDITIONS

Stop immediately rather than guessing if any of these occur:

```text
Canonical and ERD artifacts contradict each other
requested feature is absent from CURRENT freeze
implementation would require choosing an [OPEN] policy
Viewing Appointment is promoted to CURRENT
favorite/bookmark semantics must become CURRENT
reservation/hold/24-hour price guarantee is required
room/property type vocabulary must be invented while ownership is OPEN
TrustReport policy requires choosing login/rate-limit/moderation/evidence behavior
Review policy requires choosing edit/minimum-occupancy/multiplicity/rating dimensions
payment evidence confirmation permission requires an unresolved policy decision
advanced staff/team/delegation becomes required
schema change appears necessary for a new product requirement
```

When stopped for product authority, do not patch the database/backend first.

Use this order:

```text
Canonical
-> ERD LV1
-> ERD LV2
-> ERD LV3
-> validated SQL
-> project/use-case docs
-> conformance tests
-> backend implementation
```

---

# 7. What NOT to implement in this handoff

Do not proceed into these domains after H6 without a new approved implementation plan:

```text
Listing + ListingStatusEvent + Inquiry
Tenancy + TenancyParticipant + TenancyTerms + TermsAcknowledgement + TenancyNotice
Finance / Deposit / Receipt rebuild
Incident / Review / TrustReport / Notification rebuild
relationship/resource authorization hardening
ORM / PostgreSQL runtime adapters
migrations
transaction/concurrency guards
```

---

# 8. Next implementation waves

After H6, create a new plan for each wave.

| Wave | Scope | Critical invariants |
| --- | --- | --- |
| B | Listing + Inquiry + Tenancy + Participant + Terms + Ack + Notice | publish only from eligible vacant Room; synchronous unpublish on leaving vacancy; max one current Listing; max one non-terminal Tenancy; participant != User; versioned terms; confirmed checkout ends Tenancy and vacates Room |
| C | Billing/Charge/Payment/Allocation/Claim/Deposit/Receipt/Utilities | Payment is real inflow; one Tenancy ownership; charge whitelist RENT/ELECTRICITY/WATER; allocation/application caps; Receipt != Payment; correction by void/reverse + replacement |
| D | Incident/Event + Review + TrustReport + Notification/read models | exact Incident FSM/categories; append-only events; ended-tenancy review eligibility; TrustReport targets Listing XOR Review; Notification is side effect only |
| E | Auth hardening | identity authenticates User; authorization derives from Organization owner / TenancyParticipant / resource relationships; never global business role |
| F | Persistence/migrations/concurrency guards | lock-safe payment/deposit caps; one non-terminal tenancy; Listing/Room coordination; atomic checkout + Room transition |

---

# 9. Commit / review policy

Prefer one logical commit per packet:

```text
H0 test: split identity handoff gate from organization red baseline
H1 docs: freeze identity ERD3 runtime evidence
H2 refactor: align organization ownership with ERD3
H3 refactor: align property lifecycle and location with ERD3
H4 refactor: rebuild room lifecycle for ERD3
H5 refactor: remove future modules from current runtime
H6 docs: freeze ERD3 core rebuild handoff evidence
```

If tooling forces multiple mechanical commits, keep them contiguous and clearly associated with the same packet.

Do not squash away evidence until review is complete.

---

# 10. Agent completion report

When H6 is done, report only evidence-backed results using this template:

```markdown
## ERD3 Core Rebuild Completion

Branch: backend/core-foundations
Final SHA: <sha>

### GREEN
- Identity: <commands + result>
- Organization: <commands + result>
- Property: <commands + result>
- Room: <commands + result>
- FUTURE runtime boundary: <commands + result>
- Typecheck: PASS
- DB validators: PASS

### Expected remaining RED
- Listing: <exact failing tests>
- Tenancy: <exact failing tests>
- Finance: <exact failing tests>
- Incident: <exact failing tests>
- Trust: <exact failing tests>

### Not started
- Persistence/migrations
- Concurrency guards
- Auth/resource hardening

### Commits
- <sha> H0 ...
- <sha> H1 ...
- ...
```

Never report a PASS that was not freshly executed and observed.

---

# 11. Start here

Execute **H0 now**.

Do not ask which task to start with. Do not implement Organization before H0 makes Identity independently verifiable.
