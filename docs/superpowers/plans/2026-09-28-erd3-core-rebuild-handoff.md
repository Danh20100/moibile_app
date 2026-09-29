# ERD3 Core Rebuild Handoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hand off the remaining ERD3 core rebuild as deterministic, reviewable execution packets: first establish an independently verifiable Identity GREEN baseline, then rebuild Organization, Property, Room, and CURRENT runtime registration without weakening Canonical v3.7 or prematurely entering later domains.

**Architecture:** This handoff does not redefine the domain model. It orchestrates the already-approved ERD3 reconciliation design and `2026-09-28-erd3-core-backend-rebuild.md`, while repairing one execution-boundary defect: the current focused CI gate mixes already-rebuilt Identity assertions with intentionally RED Organization assertions. After that split, each packet owns one semantic boundary, follows TDD, records runtime evidence, and may proceed only when its focused gate is GREEN. Full ERD3 remains intentionally RED until later domain waves are rebuilt.

**Tech Stack:** NestJS 12, TypeScript 6, Node.js 24, `node:test` through `tsx`, pnpm 10, class-validator/class-transformer, GitHub Actions, existing Python ERD3 validators, in-memory domain services for the current rebuild stage.

**Spec:** `docs/superpowers/specs/2026-09-28-erd3-backend-reconciliation-design.md`

**Primary execution plan:** `docs/superpowers/plans/2026-09-28-erd3-core-backend-rebuild.md`

**Prepared from branch state:** `backend/core-foundations` at pre-handoff implementation head `b702e3c353c441b8719d55f05018b31c80e017ec` (`ci: capture focused ERD3 runtime evidence`). The commit that adds this handoff document is documentation-only and does not advance domain implementation.

## Global Constraints

- Authority order remains `docs/database/canonical-v3.7.md` → ERD LV1 → ERD LV2 → ERD LV3 → validated PostgreSQL/PostGIS reference DDL → repository/module docs → implementation/tests.
- Lower layers never weaken a frozen invariant to preserve an old backend contract.
- `[OPEN]` policy stays unresolved. Do not convert OPEN policy into DTO defaults, guards, role rules, status values, migration defaults, or undocumented assumptions.
- `[FUTURE]` capabilities stay outside CURRENT runtime. In particular: Subscription/Pricing/Quota, CSV/Excel import, advanced team/staff/delegation, partner marketplace, AI/OCR, full realtime messaging, saved search/advanced favorites, payment-gateway dependency, OTA/instant booking, proration, and public personal landlord/tenant rating.
- Do not add Viewing Appointment, favorites/bookmarks, reservation/hold, or `giữ giá 24 giờ` in this core rebuild. If product confirms any of those as CURRENT, stop and reconcile Canonical → ERD LV1 → LV2 → LV3 → SQL before backend implementation.
- No ORM selection, production persistence adapter, runtime migration, or concurrency-safety claim belongs to this handoff.
- USER is digital identity only. No global `owner | operator | tenant | platform_admin` business role may return.
- Organization MVP has exactly one primary-owner user reference. Staff/member/delegation semantics are not to be invented.
- Client input must never be treated as authoritative cross-context blocker truth. Property/Room archive blocker structures are internal service seams only until authoritative orchestration/persistence exists.
- Property lifecycle is exactly `ACTIVE | ARCHIVED`.
- Room owns separate `operationalState = VACANT | OCCUPIED | MAINTENANCE | INACTIVE` and `recordLifecycle = ACTIVE | ARCHIVED`; it does not own agreed rent/base price.
- `VACANT → OCCUPIED` is caused only by tenancy activation; `OCCUPIED → VACANT` only by confirmed checkout. Direct `OCCUPIED → MAINTENANCE` and `OCCUPIED → INACTIVE` are invalid.
- Archived Property blocks Room creation/reactivation. Room archive requires INACTIVE plus no non-terminal Tenancy and no open Incident.
- `pnpm typecheck` and frozen database validators are hard gates after every implementation packet that changes TypeScript/domain code.
- The full ERD3 suite may remain RED only for explicitly named, not-yet-rebuilt domains. Import errors, syntax errors, broken test harnesses, unexplained failures, or regressions are never acceptable expected RED.
- Preserve valid Google identity verification behavior and still-valid engineering tests. Rewrite/remove only tests whose business semantics were superseded by ERD3.
- Do not merge or start persistence work while the core-stage completion matrix in this plan is incomplete.

## Review Focus

1. **False Identity handoff failure:** the current mixed Identity/Organization conformance file must not remain the focused hard gate, because Organization is intentionally unrebuilt at the Identity freeze point. Identity needs its own independently GREEN file.
2. **Authority leakage through convenience fields:** no global User role, room-owned rent, mutable Organization owner/status, or client-supplied archive blocker should sneak back in to preserve old API shape.
3. **Lifecycle causality:** generic HTTP Room state updates must never impersonate tenancy activation/checkout, and archived ancestors must block child creation/reactivation.
4. **Expected RED masking regressions:** full-suite RED is acceptable only when each failure maps to a named later domain packet; `continue-on-error` must not make unknown failures look healthy.
5. **Premature completeness claims:** in-memory service guards demonstrate domain ownership only; they do not prove transaction-safe enforcement, resource authorization, or production persistence.

---

## Handoff State Matrix

This matrix is the execution scoreboard. Do not mark a cell GREEN from source inspection alone; GREEN means fresh runtime evidence was observed for that packet.

| Boundary | Start of handoff | After H0/H1 | After H2 | After H3 | After H4 | After H5 |
| --- | --- | --- | --- | --- | --- | --- |
| Authority/docs | GREEN baseline | GREEN | GREEN | GREEN | GREEN | GREEN |
| Identity | implemented, focused gate mixed | GREEN | GREEN | GREEN | GREEN | GREEN |
| Organization | RED | RED | GREEN | GREEN | GREEN | GREEN |
| Property | RED | RED | RED | GREEN | GREEN | GREEN |
| Room | RED | RED | RED | RED | GREEN | GREEN |
| FUTURE runtime boundary | RED until stale registrations removed | RED | RED | RED | RED | GREEN |
| Listing | RED | RED | RED | RED | RED | RED — later wave |
| Tenancy | RED | RED | RED | RED | RED | RED — later wave |
| Finance | RED | RED | RED | RED | RED | RED — later wave |
| Incident | RED | RED | RED | RED | RED | RED — later wave |
| Trust | RED | RED | RED | RED | RED | RED — later wave |
| DB validators | must stay GREEN | GREEN | GREEN | GREEN | GREEN | GREEN |

---

### Task H0: Split the mixed Identity/Organization conformance boundary

**Purpose:** Repair the handoff/test boundary before any new domain implementation. The current `identity-organization.contract.test.ts` combines a finished Identity assertion with Organization assertions that are intentionally RED, while CI treats the whole file as a focused hard gate.

**Files:**
- Create: `tests/conformance/erd3/identity.contract.test.ts`
- Create: `tests/conformance/erd3/organization.contract.test.ts`
- Delete: `tests/conformance/erd3/identity-organization.contract.test.ts`
- Modify: `.github/workflows/backend-erd3-conformance.yml`
- Modify: `docs/superpowers/plans/2026-09-28-erd3-core-backend-rebuild.md`
- Modify: `tests/conformance/erd3/README.md` only where it enumerates/teaches the old mixed boundary.

**Interfaces:**
- Produces an Identity-only hard gate:
  `pnpm exec tsx --test tests/conformance/erd3/identity.contract.test.ts`.
- Produces an Organization-only RED-to-GREEN target:
  `pnpm exec tsx --test tests/conformance/erd3/organization.contract.test.ts`.
- Preserves all existing semantic assertions; this task changes ownership/file boundaries, not the frozen requirements.
- `pnpm test:conformance:erd3` continues to discover both files through the existing `*.test.ts` glob.

- [ ] **Step 1: Capture the current false-focused baseline**

Run:

```bash
pnpm exec tsx --test tests/conformance/erd3/identity-organization.contract.test.ts
```

Expected at the pre-H0 branch state: the USER/global-role test is capable of passing, while one or more Organization assertions remain RED because Organization has not yet been rebuilt. If Identity itself fails, stop and fix/reconcile Identity before splitting; do not hide an Identity regression by moving tests.

- [ ] **Step 2: Create `identity.contract.test.ts` with only the current USER boundary assertion**

Move the test named:

```ts
test('USER contract has no global business role', ...);
```

It must continue reading all four current Identity source surfaces:

```text
src/modules/identity-access/contracts/index.ts
src/modules/identity-access/dto/index.ts
src/modules/identity-access/services/identity-access.service.ts
src/modules/identity-access/controllers/identity-access.controller.ts
```

Keep assertions that reject `UserRole`, a `role:` property, the old business-role literals, invitation DTOs, and invitation routes/surfaces.

- [ ] **Step 3: Create `organization.contract.test.ts` with only Organization authority assertions**

Move these existing assertions without weakening them:

```ts
test('ORGANIZATION contract carries the primary owner reference', ...);
test('old OrganizationStatus active inactive archived is not treated as ERD3 source truth', ...);
```

This file is intentionally RED until H2.

- [ ] **Step 4: Delete the mixed conformance file**

Delete `tests/conformance/erd3/identity-organization.contract.test.ts` only after all three assertions exist in the two replacement files.

- [ ] **Step 5: Update the CI hard gate**

In `.github/workflows/backend-erd3-conformance.yml`, replace:

```text
Focused Identity and Organization boundary conformance
→ tests/conformance/erd3/identity-organization.contract.test.ts
```

with an Identity-only hard gate:

```text
Focused Identity boundary conformance
→ tests/conformance/erd3/identity.contract.test.ts
```

Do not add Organization as a hard pre-H2 CI step. Organization remains exercised by the full ERD3 baseline, which is expected RED at this stage.

- [ ] **Step 6: Update plan/test documentation references**

In `2026-09-28-erd3-core-backend-rebuild.md`, replace mixed-file commands with the appropriate Identity or Organization file per task:

```text
Task 1 / Identity verification → identity.contract.test.ts
Task 2 / Organization RED-GREEN → organization.contract.test.ts, plus identity.contract.test.ts when a cross-boundary regression check is useful
Task 6 / core gate → both files
```

Update `tests/conformance/erd3/README.md` only if it names the old mixed file.

- [ ] **Step 7: Verify the split expresses the intended RED/GREEN state**

Run:

```bash
pnpm exec tsx --test tests/conformance/erd3/identity.contract.test.ts
pnpm exec tsx --test tests/conformance/erd3/organization.contract.test.ts
pnpm typecheck
python -m unittest discover -s tests/database -p "test_*.py"
```

Expected:

```text
identity.contract.test.ts      PASS
organization.contract.test.ts  FAIL for still-unrebuilt Organization semantics
pnpm typecheck                 PASS
database validators            PASS
```

A failing Organization file is the correct expected RED here. A failing Identity/typecheck/database gate blocks handoff.

- [ ] **Step 8: Commit H0**

```bash
git add .github/workflows/backend-erd3-conformance.yml \
  tests/conformance/erd3 \
  tests/conformance/erd3/README.md \
  docs/superpowers/plans/2026-09-28-erd3-core-backend-rebuild.md
git commit -m "test: split identity handoff gate from organization red baseline"
```

**Packet exit condition:** incoming workers can prove Identity GREEN without requiring Organization to be implemented.

---

### Task H1: Freeze the rebuilt Identity packet with runtime evidence

**Purpose:** Close Identity as a handed-off, tested boundary. This packet must not add Organization code or new product behavior.

**Files:**
- Normally no product-code change.
- Modify only if observed evidence requires correction: Identity source/tests owned by H1.
- Modify: `docs/audits/2026-09-28-erd3-conformance-red-baseline.md` to record fresh observed Identity evidence.

**Interfaces:**
- Consumes H0 `identity.contract.test.ts`.
- Preserves `UserReference { userId: string }` and identity-only `UserProfile`.
- Preserves Google sign-in/token verification behavior.
- Produces a documented Identity GREEN handoff baseline and no Organization implementation.

- [ ] **Step 1: Verify Identity conformance independently**

Run:

```bash
pnpm exec tsx --test tests/conformance/erd3/identity.contract.test.ts
```

Expected: PASS.

- [ ] **Step 2: Verify Google identity integration regression tests**

Run:

```bash
pnpm exec tsx --test src/integrations/google-identity/google-id-token-verifier.spec.ts
```

Expected: PASS. If the command exposes a test-runner mismatch rather than an assertion failure, use the repository's existing test command that includes this file and record the exact observed command in the audit; do not silently skip Google identity verification.

- [ ] **Step 3: Verify compile and frozen DB authority**

Run:

```bash
pnpm typecheck
python -m unittest discover -s tests/database -p "test_*.py"
```

Expected: both PASS.

- [ ] **Step 4: Run the full ERD3 suite as a classification check**

Run:

```bash
pnpm test:conformance:erd3
```

Expected: Identity assertions PASS. Organization/Property/Room/Listing/Tenancy/Finance/Incident/Trust and FUTURE-runtime assertions may remain RED only where not yet rebuilt. Record exact failing test names; do not summarize them merely as “expected red.”

- [ ] **Step 5: Record evidence in the audit**

Update `docs/audits/2026-09-28-erd3-conformance-red-baseline.md` with:

```text
Identity: observed PASS
command(s): exact commands above
commit SHA: SHA tested
remaining RED: exact test names grouped by owning future packet
runtime timestamp/run reference: when available
```

Do not mark Organization implemented.

- [ ] **Step 6: Commit H1 evidence only if the audit changed**

```bash
git add docs/audits/2026-09-28-erd3-conformance-red-baseline.md
git commit -m "docs: freeze identity ERD3 runtime evidence"
```

**Packet exit condition:** Identity is independently GREEN, Google identity remains protected, typecheck and DB validators are GREEN, and every remaining conformance RED has an owner.

---

### Task H2: Rebuild Organization around one immutable primary-owner relationship

**Purpose:** Implement the first still-RED domain boundary. Do not start Property in this packet.

**Files:**
- Modify: `src/modules/organization/contracts/index.ts`
- Modify: `src/modules/organization/dto/index.ts`
- Modify: `src/modules/organization/services/organization.service.ts`
- Modify: `src/modules/organization/controllers/organization.controller.ts`
- Create: `tests/core/organization.behavior.test.ts`
- Modify only obsolete Organization assertions in: `tests/audit/low-level-architecture/*.test.ts`
- Strengthen if required: `tests/conformance/erd3/organization.contract.test.ts`

**Interfaces:**
- Produces exactly:

```ts
export interface OrganizationProfile {
  id: string;
  name: string;
  primaryOwnerUserId: string;
  createdAt: string;
  updatedAt: string;
}
```

- `CreateOrganizationDto`: `name`, `primaryOwnerUserId`.
- `UpdateOrganizationDto`: optional `name` only.
- Removes `OrganizationStatus`, `description`, generic owner mutation, and generic status mutation.
- `primaryOwnerUserId` at this scaffold stage is domain identity input, not proof of authorization; principal-derived ownership is deferred to auth hardening.

- [ ] **Step 1: Write Organization behavior tests before implementation**

Create `tests/core/organization.behavior.test.ts` covering exactly:

```text
create() stores primaryOwnerUserId
update() can rename
update() cannot replace primaryOwnerUserId even when an untyped extra field is supplied
returned Organization has no status field
returned Organization has no description field
find/list behavior still returns defensive/current records according to valid existing engineering semantics
```

- [ ] **Step 2: Prove Organization RED**

Run:

```bash
pnpm exec tsx --test \
  tests/core/organization.behavior.test.ts \
  tests/conformance/erd3/organization.contract.test.ts
```

Expected: FAIL on missing primary owner and/or stale Organization status/description semantics. A syntax/import failure is not valid RED.

- [ ] **Step 3: Replace Organization contract and DTO boundary**

Implement the exact `OrganizationProfile`. Validate non-empty `name` and `primaryOwnerUserId` on create. Update DTO exposes only `name?`.

- [ ] **Step 4: Implement Organization service semantics**

`create(dto)` persists the primary owner in the in-memory record. `update(id, dto)` may change only `name` and `updatedAt`. Do not add owner-transfer, members, staff, invitation, status, archive, or role-assignment behavior.

- [ ] **Step 5: Reconcile controller and obsolete Organization tests**

Controller copy/routes must describe the rental operating workspace and must not expose owner mutation/status lifecycle. Rewrite/delete only tests whose OrganizationStatus/description assumptions were superseded.

- [ ] **Step 6: Verify H2 GREEN and Identity non-regression**

Run:

```bash
pnpm exec tsx --test \
  tests/conformance/erd3/identity.contract.test.ts \
  tests/conformance/erd3/organization.contract.test.ts \
  tests/core/organization.behavior.test.ts
pnpm typecheck
python -m unittest discover -s tests/database -p "test_*.py"
```

Expected: all PASS.

- [ ] **Step 7: Commit H2**

```bash
git add src/modules/organization \
  tests/core/organization.behavior.test.ts \
  tests/conformance/erd3/organization.contract.test.ts \
  tests/audit/low-level-architecture
git commit -m "refactor: align organization ownership with ERD3"
```

**Packet exit condition:** Identity + Organization GREEN; Property/Room and later domains remain untouched RED.

---

### Task H3: Rebuild Property location ownership and guarded archive lifecycle

**Purpose:** Make Property match frozen ERD3 semantics without exposing fake client-authoritative archive preconditions.

**Files:**
- Modify: `src/modules/property/contracts/index.ts`
- Modify: `src/modules/property/dto/index.ts`
- Modify: `src/modules/property/services/property.service.ts`
- Modify: `src/modules/property/controllers/property.controller.ts`
- Create: `tests/core/property.behavior.test.ts`
- Strengthen: `tests/conformance/erd3/property-room.lifecycle.test.ts`
- Modify only obsolete Property assertions in: `tests/audit/low-level-architecture/*.test.ts`

**Interfaces:**

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

- `archive(id, blockers)` is an internal service seam only in this stage.
- No HTTP DTO may accept those blocker booleans as truth.
- No reactivation/unarchive method.

- [ ] **Step 1: Write Property behavior tests**

Cover:

```text
create starts lifecycleStatus=active
operationalLocation and publicLocationProjection are distinct
public projection can update without overwriting operational location
latitude validates [-90, 90]
longitude validates [-180, 180]
archive rejects for each blocker independently
archive succeeds only when all blockers are false
ARCHIVED is terminal
update cannot unarchive or mutate lifecycle
HTTP/client DTO has no blocker fields
```

- [ ] **Step 2: Prove Property RED while isolating Room RED**

Run the new behavior tests plus `property-room.lifecycle.test.ts`. Expected: Property assertions fail before implementation; Room assertions may independently remain RED. Identify which failures belong to Property before coding.

- [ ] **Step 3: Implement exact Property contracts/DTOs**

Use latitude/longitude numbers in the in-memory domain. Do not add PostGIS runtime code or persistence mapping.

- [ ] **Step 4: Implement guarded lifecycle in `PropertyService`**

Create → active. Generic update only changes allowed presentation/location fields. `archive()` requires active + every blocker false, then moves active → archived. Second archive rejects.

- [ ] **Step 5: Keep archive HTTP orchestration closed**

Do not add a route that accepts `PropertyArchiveBlockers`. Later Listing/Tenancy/Incident orchestration will supply authoritative facts.

- [ ] **Step 6: Verify H3**

Run:

```bash
pnpm exec tsx --test tests/core/property.behavior.test.ts
pnpm exec tsx --test tests/conformance/erd3/identity.contract.test.ts tests/conformance/erd3/organization.contract.test.ts
pnpm typecheck
python -m unittest discover -s tests/database -p "test_*.py"
```

Then run:

```bash
pnpm exec tsx --test tests/conformance/erd3/property-room.lifecycle.test.ts
```

Expected: Property-owned assertions GREEN; only Room-owned assertions may remain RED.

- [ ] **Step 7: Commit H3**

```bash
git add src/modules/property \
  tests/core/property.behavior.test.ts \
  tests/conformance/erd3/property-room.lifecycle.test.ts \
  tests/audit/low-level-architecture
git commit -m "refactor: align property lifecycle and location with ERD3"
```

**Packet exit condition:** Identity + Organization + Property GREEN; Room remains the only RED boundary inside the current core semantic file.

---

### Task H4: Rebuild Room dual-state lifecycle and explicit transition causality

**Purpose:** Replace the stale single-status/price-owning Room model with ERD3 operational state + record lifecycle, while protecting tenancy-caused occupancy transitions from generic HTTP mutation.

**Files:**
- Modify: `src/modules/room/contracts/index.ts`
- Modify: `src/modules/room/dto/index.ts`
- Modify: `src/modules/room/services/room.service.ts`
- Modify: `src/modules/room/controllers/room.controller.ts`
- Create: `tests/core/room.behavior.test.ts`
- Strengthen/convert: `tests/conformance/erd3/property-room.lifecycle.test.ts`
- Modify only obsolete Room assertions in: `tests/audit/low-level-architecture/*.test.ts`

**Interfaces:**

```ts
export type RoomOperationalState = 'vacant' | 'occupied' | 'maintenance' | 'inactive';
export type RoomRecordLifecycle = 'active' | 'archived';
export type RoomOperationalTransitionCause = 'manual' | 'tenancy_activated' | 'checkout_confirmed';

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

- `CreateRoomDto`: `propertyId`, `nameOrLabel`.
- `UpdateRoomDto`: optional `nameOrLabel` only.
- Manual operational-state HTTP DTO exposes only `vacant | maintenance | inactive`.
- `transitionOperationalState(id, nextState, cause)` owns FSM/cause validation.
- `archive(id, blockers)` is internal only and not claimed transaction-safe.

- [ ] **Step 1: Write Room behavior tests**

Cover all frozen behavior:

```text
new room = vacant + active
no authoritative basePrice/rent/area/maxOccupants fields
manual vacant→maintenance|inactive
manual maintenance→vacant|inactive
manual inactive→vacant
manual vacant→occupied rejected
vacant→occupied only tenancy_activated
manual occupied→vacant rejected
occupied→vacant only checkout_confirmed
occupied→maintenance rejected for all causes
occupied→inactive rejected for all causes
archive is not an operational state
archive requires inactive
archive rejects non-terminal tenancy blocker
archive rejects open incident blocker
eligible archive sets recordLifecycle=archived
archived room rejects every operational transition
room create under archived property rejects
inactive→vacant under archived property rejects
client/manual route cannot claim tenancy_activated or checkout_confirmed
```

- [ ] **Step 2: Prove Room RED**

Run:

```bash
pnpm exec tsx --test \
  tests/core/room.behavior.test.ts \
  tests/conformance/erd3/property-room.lifecycle.test.ts
```

Expected: RED specifically on old Room semantics/missing parent guards. Import/syntax failures are defects, not acceptance evidence.

- [ ] **Step 3: Replace Room contracts and DTOs**

Remove old `RoomStatus`, room-owned `basePrice`, `area`, `maxOccupants`, and any use of archived as an operational state solely for compatibility.

- [ ] **Step 4: Implement exact cause-aware FSM**

Allowed pairs only:

```text
manual:
  vacant      → maintenance | inactive
  maintenance → vacant | inactive
  inactive    → vacant

tenancy_activated:
  vacant      → occupied

checkout_confirmed:
  occupied    → vacant
```

Reject all other state/cause pairs. Reject every operational transition when `recordLifecycle === 'archived'`.

- [ ] **Step 5: Enforce active Property parent on create/reactivation**

Read Property lifecycle from `PropertyService`; do not cache a duplicate lifecycle truth in Room. Archived parent blocks create and inactive → vacant.

- [ ] **Step 6: Implement Room archive command**

Require inactive + no non-terminal tenancy + no open incident, then set record lifecycle archived. Do not synchronize Listing here yet and do not expose blocker booleans via HTTP.

- [ ] **Step 7: Restrict controller mutation to manual transitions**

Replace stale `PATCH /rooms/:id/status` with `PATCH /rooms/:id/operational-state`. Controller always invokes cause `manual`, so occupancy cannot be set directly by a client.

- [ ] **Step 8: Reconcile obsolete Room tests**

Rewrite/delete tests that require `draft`, room-owned base price, archived-as-operational-state, or `OCCUPIED → MAINTENANCE`. Preserve still-valid missing-parent, defensive-copy, and invalid-transition tests.

- [ ] **Step 9: Verify H4 core boundary GREEN**

Run:

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

- [ ] **Step 10: Commit H4**

```bash
git add src/modules/room \
  tests/core/room.behavior.test.ts \
  tests/conformance/erd3/property-room.lifecycle.test.ts \
  tests/audit/low-level-architecture
git commit -m "refactor: rebuild room lifecycle for ERD3"
```

**Packet exit condition:** Identity/Organization/Property/Room focused semantics are all GREEN without claiming tenancy orchestration or persistence concurrency safety.

---

### Task H5: Remove FUTURE-only runtime registrations from current `AppModule`

**Purpose:** Make runtime registration match CURRENT freeze without deleting dormant future source trees prematurely.

**Files:**
- Modify: `src/app.module.ts`
- Strengthen: `tests/conformance/erd3/future-open-boundary.static.test.ts`
- Modify only obsolete module-registration assertions in: `tests/audit/low-level-architecture/*.test.ts`

**Interfaces:**
- Current `AppModule` must not register `SubscriptionModule`.
- Current `AppModule` must not register the existing batch-oriented `OnboardingModule` as current CSV/Excel/bulk-import functionality.
- Source directories may remain dormant scaffolding.
- Manual Organization/Property/Room creation remains current and is not replaced by import functionality.

- [ ] **Step 1: Strengthen FUTURE boundary test first**

Assert current `src/app.module.ts` imports/registers neither module. Do not require source-directory deletion.

- [ ] **Step 2: Prove RED**

Run:

```bash
pnpm exec tsx --test tests/conformance/erd3/future-open-boundary.static.test.ts
```

Expected: FAIL while stale current-runtime registrations remain.

- [ ] **Step 3: Remove only the two runtime registrations/imports**

Do not implement replacements or add feature flags/subscription entitlements/import endpoints.

- [ ] **Step 4: Reconcile obsolete architecture assertions**

Remove only tests that incorrectly require those FUTURE modules in current runtime.

- [ ] **Step 5: Verify H5**

Run:

```bash
pnpm exec tsx --test tests/conformance/erd3/future-open-boundary.static.test.ts
pnpm typecheck
python -m unittest discover -s tests/database -p "test_*.py"
```

Expected: all PASS.

- [ ] **Step 6: Commit H5**

```bash
git add src/app.module.ts \
  tests/conformance/erd3/future-open-boundary.static.test.ts \
  tests/audit/low-level-architecture
git commit -m "refactor: remove future modules from current runtime"
```

**Packet exit condition:** CURRENT app wiring no longer advertises FUTURE Subscription or CSV/Excel/batch import as active product capabilities.

---

### Task H6: Freeze the core stage and produce the next-wave handoff evidence

**Purpose:** Convert the completed core work into a trustworthy boundary for the next domain plan. No new domain implementation belongs in H6.

**Files:**
- Modify: `docs/audits/2026-09-28-erd3-conformance-red-baseline.md`
- Modify: `tests/conformance/erd3/README.md` only if observed runtime behavior requires documentation clarification.
- No production-domain changes unless verification uncovers a regression; if so, return to the owning packet instead of patching during H6.

**Interfaces:**
- Consumes H0–H5.
- Produces a runtime-verified core-stage matrix.
- Leaves Listing/Tenancy/Finance/Incident/Trust RED and explicitly assigns each to a later wave.

- [ ] **Step 1: Run focused core behavior + conformance gate**

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

Expected: PASS.

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 3: Run frozen database validators**

```bash
python -m unittest discover -s tests/database -p "test_*.py"
```

Expected: PASS with no authority-artifact modification required by this core rebuild.

- [ ] **Step 4: Run full ERD3 conformance and classify every failure**

```bash
pnpm test:conformance:erd3
```

Expected:

```text
GREEN: authority, identity, organization, property/room, future-runtime boundary
RED only: listing, tenancy, finance, incident, trust boundaries not yet rebuilt
```

If another boundary fails, stop. Do not call it expected until its exact assertion maps to a later approved packet.

- [ ] **Step 5: Run full repository tests**

```bash
pnpm test
```

Expected: no type/import/harness failures and no regression in rebuilt core behavior. Remaining failures must be explainable by still-unrebuilt ERD3 semantics or deliberately obsolete tests outside the touched core. Record exact test names.

- [ ] **Step 6: Update audit with exact observed evidence**

For every boundary, record:

```text
status: PASS | EXPECTED RED | BLOCKED
command
commit SHA tested
exact failing/passing test names as appropriate
owning next-wave plan for every expected RED
CI run/artifact reference when available
```

Do not convert source-inspected assumptions into runtime PASS.

- [ ] **Step 7: Verify CI workflow semantics after the split**

The workflow should hard-fail on:

```text
install failure
typecheck failure
Identity focused failure
database validator failure
failure of the script that proves remaining ERD3 RED is a real test failure
failure to produce recognizable full-test output
```

It may tolerate the known full ERD3/full-test RED only while the audit explicitly names those remaining domain failures.

- [ ] **Step 8: Commit H6 evidence**

```bash
git add docs/audits/2026-09-28-erd3-conformance-red-baseline.md tests/conformance/erd3/README.md
git commit -m "docs: freeze ERD3 core rebuild handoff evidence"
```

**Core-stage exit condition:** all core-focused tests, typecheck, and database validators are GREEN; full conformance RED is confined to named later domains; the audit contains fresh runtime evidence rather than inferred results.

---

## Next-Wave Dependency Map — Do Not Implement in This Handoff

The incoming lead should create a new spec/plan cycle for each wave rather than extending H2–H6 opportunistically.

| Wave | Domain scope | Depends on | Critical invariants to carry forward |
| --- | --- | --- | --- |
| B | Listing + ListingStatusEvent + Inquiry + Tenancy + TenancyParticipant + TenancyTerms + TermsAcknowledgement + TenancyNotice | Core H6 | vacancy/publish coordination; one current Listing; one non-terminal Tenancy; participant ≠ User; versioned terms; checkout → Room VACANT |
| C | BillingCycle + Charge + Payment + PaymentAllocation + PaymentClaim + Deposit + applications/settlements/events + Receipt + utility records | Wave B tenancy semantics | one-tenancy money ownership; charge whitelist; allocation/application caps; receipt ≠ payment; correction by void/reverse + replacement |
| D | Incident + IncidentEvent + Review + TrustReport + Notification + read models | Waves B/C where references require them | exact Incident FSM/categories; append-only events; ended-tenancy review eligibility; TrustReport target XOR; Notification not business truth |
| E | Auth hardening and relationship/resource authorization | Stable CURRENT domain relationships from B–D | identity authenticates a User only; access derives from primary-owner/participant/resource relationships; no scalar global business role |
| F | Persistence selection + migrations/adapters + transaction guards | Domain contracts converged through E | payment cap, deposit settlement cap, one non-terminal tenancy, Listing/Room vacancy coordination, atomic checkout/Room state under locking |

### Mandatory product-authority stop points

If execution encounters any of the following, stop the backend packet and escalate to product/domain authority instead of inventing a solution:

```text
Viewing appointment / viewing schedule requested as CURRENT
Favorite/bookmark requested as CURRENT without frozen authority
24-hour price/availability hold or reservation requested
new room/property type vocabulary requested while owner remains OPEN
payment evidence confirmation permission requires choosing an OPEN policy
TrustReport login/rate-limit/moderation/evidence policy requires a choice
review edit/minimum-occupancy/multiplicity/rating-dimension policy requires a choice
advanced staff/team/delegation permissions requested
```

Authority-changing work proceeds top-down:

```text
Canonical → ERD LV1 → ERD LV2 → ERD LV3 → validated SQL → product/use-case docs → conformance tests → backend implementation
```

---

## Incoming Worker Runbook

An incoming worker should begin from the first incomplete packet, not from whichever source file looks easiest.

1. Read `docs/database/canonical-v3.7.md`, the three frozen ERDs, the reconciliation design, this handoff, then the primary core rebuild plan.
2. Confirm branch/head and inspect the latest audit. Never assume a previous runtime command passed merely because code exists.
3. Execute exactly one packet with TDD. Do not batch H2/H3/H4 together because each boundary has its own reviewer gate and downstream interface dependency.
4. After each packet, run that packet's focused test, `pnpm typecheck`, and DB validators; record evidence before moving on.
5. At H6, classify the full suite by test name. Only then hand off to Wave B.

## Commit / Review Boundaries

Use one logical commit per packet unless a tool limitation forces smaller mechanical commits. If multiple commits are necessary, keep them contiguous and label them with the packet purpose. A reviewer may reject one packet without invalidating previously frozen packets.

Recommended final review checkpoints:

```text
R0 after H0/H1: Identity evidence boundary and runtime freeze
R1 after H2: Organization ownership
R2 after H3: Property lifecycle/location
R3 after H4: Room FSM/archive/ancestor guards
R4 after H5: FUTURE runtime surface
R5 after H6: whole core branch + expected RED classification
```

## Completion Gate

Do not declare this handoff completed until all boxes below are backed by fresh evidence:

```text
[PASS] Identity has an independent conformance file/hard gate.
[PASS] USER has no global business role or role-assignment invitation surface.
[PASS] Google identity verification remains protected.
[PASS] Organization has one immutable primaryOwnerUserId and no stale OrganizationStatus/description lifecycle.
[PASS] Property separates operational location from public projection and archives only through guarded ACTIVE→ARCHIVED semantics.
[PASS] Room owns dual operational/record lifecycle, no rent truth, cause-aware occupancy transitions, and archived-parent guards.
[PASS] Subscription and batch Onboarding are not registered as CURRENT runtime modules.
[PASS] focused core behavior tests.
[PASS] focused ERD3 conformance for the rebuilt core.
[PASS] pnpm typecheck.
[PASS] frozen database validators.
[EXPECTED RED, NAMED] Listing/Tenancy/Finance/Incident/Trust only.
[DOCUMENTED] every remaining RED maps to a next-wave owner.
[NOT STARTED] persistence/migrations/concurrency hardening.
```

The immediate implementation entry point after this handoff is **H0**, not Organization code. Organization starts only after Identity can be independently proven GREEN.