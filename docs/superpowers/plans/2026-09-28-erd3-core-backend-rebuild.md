# ERD3 Core Backend Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the current Identity/Organization/Property/Room backend contracts and services so they conform to Canonical v3.7 / frozen ERD3 without introducing migrations, persistence tooling, or unfrozen product features.

**Architecture:** Keep the current NestJS modular-monolith and in-memory service adapters while replacing pre-ERD3 business contracts with the frozen domain model. Domain contracts become authoritative first; controllers/DTOs follow those contracts; cross-context archive checks are represented as explicit service-level guard inputs until the later persistence/transaction-guard stage can supply authoritative locked data. This plan deliberately does not add PostgreSQL adapters or resolve authorization policy beyond removing invalid global business-role semantics.

**Tech Stack:** NestJS 12, TypeScript 6, Node `node:test` via `tsx`, class-validator/class-transformer, existing in-memory services.

**Spec:** `docs/superpowers/specs/2026-09-28-erd3-backend-reconciliation-design.md`

## Global Constraints

- Canonical v3.7 → ERD LV1 → LV2 → LV3 → validated reference DDL remains authoritative.
- Do not modify ERD files, DDL, database validators, migrations, ORM/data-access tooling, or production persistence in this plan.
- Do not add Viewing Appointment, favorites, reservation/hold, partner marketplace, subscription/pricing/quota, CSV/Excel import, staff/delegation, or any other capability not in CURRENT freeze.
- `USER` is digital identity only; no global landlord/tenant/operator/platform-admin business role.
- Organization has exactly one `primaryOwnerUserId` in the MVP model; advanced membership/delegation remains FUTURE.
- Property lifecycle is exactly `ACTIVE | ARCHIVED`; archive is guarded, not a generic status patch.
- Room has separate `operationalState = VACANT | OCCUPIED | MAINTENANCE | INACTIVE` and `recordLifecycle = ACTIVE | ARCHIVED`.
- Room does not own agreed rent/base price.
- Direct `OCCUPIED → MAINTENANCE` and `OCCUPIED → INACTIVE` transitions are invalid.
- Room archive requires `INACTIVE`, no non-terminal Tenancy, and no open Incident.
- Do not claim transaction/concurrency safety in this plan. Persistence-safe guards are a later stage.
- Existing tests that encode pre-ERD3 semantics may be rewritten or deleted in the same task that removes the obsolete contract; preserve still-valid engineering tests.
- `pnpm typecheck` must remain green after each task. The full test suite may remain RED only for still-unrebuilt ERD3 conformance areas outside this plan.

## Review Focus

1. **Identity leakage:** no exported/current contract, DTO, controller, or service may continue to encode owner/operator/tenant/platform-admin as a global User role.
2. **Mutable ownership/lifecycle:** primary Organization owner and Property/Room archive lifecycle must not be writable through generic patch DTOs.
3. **Room state coupling:** occupied rooms must not be manually moved to maintenance/inactive; archive must remain separate from operational-state changes.
4. **Unfrozen fields:** Room agreed/base rent and stale Organization lifecycle/description fields must not survive as authoritative core-domain truth merely for backward compatibility.
5. **False completeness:** in-memory guard seams may prove rule ownership, but this plan must not claim concurrency-safe enforcement or authoritative cross-context reads before persistence/other domains are rebuilt.

---

### Task 1: Remove global User business roles and stale invitation membership semantics

**Files:**
- Modify: `src/modules/identity-access/contracts/index.ts`
- Modify: `src/modules/identity-access/dto/index.ts`
- Modify: `src/modules/identity-access/services/identity-access.service.ts`
- Modify: `src/modules/identity-access/controllers/identity-access.controller.ts`
- Modify or delete obsolete assertions in: `tests/audit/low-level-architecture/*.test.ts`
- Strengthen: `tests/conformance/erd3/identity-organization.contract.test.ts`

**Interfaces:**
- Produces `UserReference { userId: string }`.
- Produces `UserProfile` as identity/presentation data only: `id`, `externalSubject`, optional `email`, `name`, `pictureUrl`, `createdAt`, `updatedAt`.
- Removes `UserRole` and `UserProfile.role`.
- Removes current Organization-membership invitation API/contracts whose only purpose is pre-ERD3 `owner|operator|tenant` role assignment.
- Preserves Google identity verification behavior.

- [ ] **Step 1: Strengthen the failing conformance test**

In `tests/conformance/erd3/identity-organization.contract.test.ts`, ensure the User assertion checks all current identity-access contract/DTO/controller source and fails if it contains exported/current `UserRole`, `role?: UserRole`, or invitation role vocabulary `owner|operator|tenant|platform_admin`.

- [ ] **Step 2: Run the identity conformance file and verify RED**

Run:

```bash
pnpm exec tsx --test tests/conformance/erd3/identity-organization.contract.test.ts
```

Expected: User-role assertion FAILS against the current contract. Organization assertions may still fail for Task 2.

- [ ] **Step 3: Replace the identity contract**

Keep these public shapes:

```ts
export interface UserReference {
  userId: string;
}

export interface UserProfile {
  id: string;
  externalSubject: string;
  email?: string;
  name?: string;
  pictureUrl?: string;
  createdAt: string;
  updatedAt: string;
}
```

Remove `UserRole`, `Invitation`, `InvitationStatus`, and any contract whose semantics depend on global User business roles.

- [ ] **Step 4: Remove invitation DTO/service/controller surfaces tied to Organization role assignment**

Delete `CreateInvitationDto`, `AcceptInvitationDto`, invitation maps/methods, and `POST identity-access/invitations*` routes. Do not replace them with a new membership model; advanced team/delegation is FUTURE and tenancy linking is rebuilt later under the Tenancy plan.

- [ ] **Step 5: Update obsolete regression tests**

Remove or rewrite only tests that require the deleted invitation/global-role contract. Preserve Google identity verifier/authentication tests and generic defensive-copy/error-boundary tests that remain valid.

- [ ] **Step 6: Verify Task 1**

Run:

```bash
pnpm exec tsx --test tests/conformance/erd3/identity-organization.contract.test.ts
pnpm typecheck
```

Expected: User-role assertion PASS; Organization assertions remain RED until Task 2; typecheck PASS.

- [ ] **Step 7: Commit**

```bash
git add src/modules/identity-access tests/conformance/erd3/identity-organization.contract.test.ts tests/audit/low-level-architecture
git commit -m "refactor: align identity with ERD3 digital identity"
```

---

### Task 2: Rebuild Organization around one immutable primary-owner relationship

**Files:**
- Modify: `src/modules/organization/contracts/index.ts`
- Modify: `src/modules/organization/dto/index.ts`
- Modify: `src/modules/organization/services/organization.service.ts`
- Modify: `src/modules/organization/controllers/organization.controller.ts`
- Create: `tests/core/organization.behavior.test.ts`
- Update obsolete Organization assertions under `tests/audit/low-level-architecture/`

**Interfaces:**
- Produces:

```ts
export interface OrganizationProfile {
  id: string;
  name: string;
  primaryOwnerUserId: string;
  createdAt: string;
  updatedAt: string;
}
```

- `CreateOrganizationDto` contains `name` and `primaryOwnerUserId` only for the current scaffold. This is domain identity input, not an authorization decision; principal-derived ownership replaces it in the later auth-hardening plan.
- `UpdateOrganizationDto` contains `name?` only.
- Removes `OrganizationStatus`, `description`, and generic status mutation.

- [ ] **Step 1: Write failing Organization behavior tests**

Create `tests/core/organization.behavior.test.ts` with tests that assert:

```text
create() stores primaryOwnerUserId
update() can rename but cannot replace primary owner through UpdateOrganizationDto
returned Organization has no status field
returned Organization has no description field
```

Use `OrganizationService` directly.

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
pnpm exec tsx --test tests/core/organization.behavior.test.ts tests/conformance/erd3/identity-organization.contract.test.ts
```

Expected: FAIL because current Organization lacks primary owner and still owns old status semantics.

- [ ] **Step 3: Replace Organization contract/DTOs**

Implement the exact `OrganizationProfile` above. `CreateOrganizationDto` validates non-empty `name` and `primaryOwnerUserId`; `UpdateOrganizationDto` exposes only optional `name`.

- [ ] **Step 4: Update OrganizationService**

`create(dto: CreateOrganizationDto): Promise<OrganizationProfile>` stores the provided primary owner. `update(id, dto)` may only update `name` and `updatedAt`; it must not change owner/lifecycle through a generic patch.

- [ ] **Step 5: Update controller copy and obsolete tests**

Controller summaries must describe a rental operating workspace, not legal-company status or generic active/inactive/archive mutation. Rewrite/delete old tests that explicitly require `OrganizationStatus`.

- [ ] **Step 6: Verify Task 2**

Run:

```bash
pnpm exec tsx --test tests/core/organization.behavior.test.ts tests/conformance/erd3/identity-organization.contract.test.ts
pnpm typecheck
```

Expected: both Organization conformance assertions PASS; typecheck PASS.

- [ ] **Step 7: Commit**

```bash
git add src/modules/organization tests/core/organization.behavior.test.ts tests/conformance/erd3/identity-organization.contract.test.ts tests/audit/low-level-architecture
git commit -m "refactor: align organization ownership with ERD3"
```

---

### Task 3: Split Property operational location from public projection and guard archive lifecycle

**Files:**
- Modify: `src/modules/property/contracts/index.ts`
- Modify: `src/modules/property/dto/index.ts`
- Modify: `src/modules/property/services/property.service.ts`
- Modify: `src/modules/property/controllers/property.controller.ts`
- Create: `tests/core/property.behavior.test.ts`
- Strengthen: `tests/conformance/erd3/property-room.lifecycle.test.ts`
- Update obsolete Property assertions under `tests/audit/low-level-architecture/`

**Interfaces:**
- Produces:

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

- `CreatePropertyDto` supplies organization/name plus operational address/location and public projection.
- `UpdatePropertyDto` may update presentation/location fields only; it does not expose lifecycle.
- `archive(id: string, blockers: PropertyArchiveBlockers): Promise<PropertyProfile>` is a service-level domain seam only. Do not expose blocker booleans as HTTP request truth.

- [ ] **Step 1: Write failing Property tests**

`tests/core/property.behavior.test.ts` must assert:

```text
new Property starts lifecycleStatus=active
operationalLocation and publicLocationProjection are stored independently
update can change public projection without rewriting operational location
archive rejects when any blocker is true
archive succeeds only when all blockers are false
archived Property cannot be unarchived through generic update
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
pnpm exec tsx --test tests/core/property.behavior.test.ts tests/conformance/erd3/property-room.lifecycle.test.ts
```

Expected: Property location/archive assertions FAIL against the old single-location/status-patch model. Room assertions remain RED for Task 4.

- [ ] **Step 3: Replace Property contract and DTOs**

Use the exact interfaces above. Represent GeoPoint in the in-memory domain as latitude/longitude numbers; do not add PostGIS/persistence code. Validate latitude `[-90, 90]` and longitude `[-180, 180]` in DTOs.

- [ ] **Step 4: Implement PropertyService lifecycle rules**

Create starts `lifecycleStatus: 'active'`. `update()` changes only allowed presentation/location values. `archive()` throws `BadRequestException` when any blocker is true and otherwise transitions `active → archived`; repeated archive remains rejected or idempotent according to the existing service convention chosen in the failing test, but no reactivation path is added.

- [ ] **Step 5: Keep HTTP archive orchestration closed for now**

Do not add `POST /properties/:id/archive` that accepts blocker booleans from clients. The later Listing/Tenancy/Incident integration plan will supply authoritative blocker facts before exposing the command.

- [ ] **Step 6: Verify Task 3**

Run:

```bash
pnpm exec tsx --test tests/core/property.behavior.test.ts tests/conformance/erd3/property-room.lifecycle.test.ts
pnpm typecheck
```

Expected: Property assertions PASS; Room-specific conformance remains RED; typecheck PASS.

- [ ] **Step 7: Commit**

```bash
git add src/modules/property tests/core/property.behavior.test.ts tests/conformance/erd3/property-room.lifecycle.test.ts tests/audit/low-level-architecture
git commit -m "refactor: align property lifecycle and location with ERD3"
```

---

### Task 4: Rebuild Room dual-state lifecycle and remove room-owned rent truth

**Files:**
- Modify: `src/modules/room/contracts/index.ts`
- Modify: `src/modules/room/dto/index.ts`
- Modify: `src/modules/room/services/room.service.ts`
- Modify: `src/modules/room/controllers/room.controller.ts`
- Create: `tests/core/room.behavior.test.ts`
- Strengthen/convert: `tests/conformance/erd3/property-room.lifecycle.test.ts`
- Rewrite obsolete Room assertions under `tests/audit/low-level-architecture/`

**Interfaces:**
- Produces:

```ts
export type RoomOperationalState = 'vacant' | 'occupied' | 'maintenance' | 'inactive';
export type RoomRecordLifecycle = 'active' | 'archived';

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

- `CreateRoomDto` contains `propertyId`, `nameOrLabel` only.
- `UpdateRoomDto` contains `nameOrLabel?` only.
- `UpdateRoomOperationalStateDto` contains only the four operational states.
- `transitionOperationalState(id, nextState)` owns pure Room FSM validation.
- `archive(id, blockers)` owns archive preconditions but is not transaction-safe in this in-memory stage.

- [ ] **Step 1: Write failing Room behavior tests**

`tests/core/room.behavior.test.ts` must assert:

```text
new Room starts operationalState=vacant and recordLifecycle=active
Room has no basePrice/rent field
VACANT→OCCUPIED valid
VACANT→MAINTENANCE valid
VACANT→INACTIVE valid
OCCUPIED→VACANT valid as the state transition later used by checkout orchestration
OCCUPIED→MAINTENANCE invalid
OCCUPIED→INACTIVE invalid
MAINTENANCE→VACANT and MAINTENANCE→INACTIVE valid
INACTIVE→VACANT valid
archive is not an operational-state transition
archive rejects unless operationalState=inactive
archive rejects with non-terminal tenancy blocker
archive rejects with open incident blocker
archive sets recordLifecycle=archived when eligible
archived Room cannot reactivate or change operational state
```

- [ ] **Step 2: Run Room tests and verify RED**

Run:

```bash
pnpm exec tsx --test tests/core/room.behavior.test.ts tests/conformance/erd3/property-room.lifecycle.test.ts
```

Expected: FAIL on old draft/basePrice/single-status/invalid-transition behavior.

- [ ] **Step 3: Replace Room contract/DTOs**

Use the exact interfaces above. Remove `RoomStatus`, `basePrice`, `area`, `maxOccupants`, and direct archived operational state from the current core contract. Those unfrozen fields must not survive merely for compatibility.

- [ ] **Step 4: Implement pure operational FSM**

Use these transitions exactly:

```text
vacant      → occupied | maintenance | inactive
occupied    → vacant
maintenance → vacant | inactive
inactive    → vacant
```

If `recordLifecycle === 'archived'`, reject every operational transition.

- [ ] **Step 5: Implement guarded archive service command**

`archive(id, blockers)` requires current `operationalState === 'inactive'`, `hasNonTerminalTenancy === false`, and `hasOpenIncident === false`; then set `recordLifecycle = 'archived'`. Do not archive Listings here yet; Listing synchronization belongs to the next rebuild plan and persistence transaction safety belongs to the later guard plan.

- [ ] **Step 6: Update controller surface**

Replace stale `PATCH /rooms/:id/status` semantics with `PATCH /rooms/:id/operational-state`. Do not expose archive via a client-supplied blocker DTO in this task. Update Swagger copy so no route claims Room owns rent/price.

- [ ] **Step 7: Rewrite obsolete tests**

Delete/rewrite any old test that requires Room `draft`, `archived` as an operational status, `basePrice`, or `OCCUPIED→MAINTENANCE`. Keep tests for missing Property references, defensive copies, and invalid transition rejection where still valid.

- [ ] **Step 8: Verify Task 4**

Run:

```bash
pnpm exec tsx --test tests/core/room.behavior.test.ts tests/conformance/erd3/property-room.lifecycle.test.ts
pnpm typecheck
```

Expected: Property/Room conformance file PASS in full; typecheck PASS.

- [ ] **Step 9: Commit**

```bash
git add src/modules/room tests/core/room.behavior.test.ts tests/conformance/erd3/property-room.lifecycle.test.ts tests/audit/low-level-architecture
git commit -m "refactor: rebuild room lifecycle for ERD3"
```

---

### Task 5: Remove FUTURE-only runtime modules from the current AppModule surface

**Files:**
- Modify: `src/app.module.ts`
- Update: `tests/conformance/erd3/future-open-boundary.static.test.ts`
- Rewrite obsolete runtime/module-registration assertions under `tests/audit/low-level-architecture/`

**Interfaces:**
- Current runtime `AppModule` must not register `SubscriptionModule`.
- Current runtime `AppModule` must not register the existing batch-oriented `OnboardingModule` as if CSV/Excel/bulk import were CURRENT.
- Source directories may remain as dormant pre-ERD3/FUTURE scaffolding until a later cleanup; they are not current domain authority.
- This task does not remove manual Organization/Property/Room creation APIs.

- [ ] **Step 1: Strengthen FUTURE conformance RED test**

Assert `src/app.module.ts` contains neither `SubscriptionModule` nor `OnboardingModule` in current imports. The test must not require source-directory deletion.

- [ ] **Step 2: Run and verify RED**

Run:

```bash
pnpm exec tsx --test tests/conformance/erd3/future-open-boundary.static.test.ts
```

Expected: FAIL because both stale modules are currently registered.

- [ ] **Step 3: Remove FUTURE module registrations**

Delete the two imports and `AppModule.imports` entries only. Do not introduce replacement subscription/import services.

- [ ] **Step 4: Rewrite obsolete architecture tests**

Remove assertions that current runtime must contain Subscription or bulk onboarding. Preserve test-discovery and other architecture checks that still match the frozen current model.

- [ ] **Step 5: Verify Task 5**

Run:

```bash
pnpm exec tsx --test tests/conformance/erd3/future-open-boundary.static.test.ts
pnpm typecheck
```

Expected: FUTURE-boundary assertions PASS; typecheck PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app.module.ts tests/conformance/erd3/future-open-boundary.static.test.ts tests/audit/low-level-architecture
git commit -m "refactor: remove future modules from current runtime"
```

---

### Task 6: Core-stage reconciliation gate

**Files:**
- Modify: `docs/audits/2026-09-28-erd3-conformance-red-baseline.md`
- Modify: `tests/conformance/erd3/README.md` only if observed runtime results require clarification

**Interfaces:**
- Consumes Tasks 1–5.
- Produces a verified status for the core domains while explicitly leaving Listing/Tenancy/Finance/Incident/Trust conformance RED for later plans.

- [ ] **Step 1: Run focused core tests**

Run:

```bash
pnpm exec tsx --test \
  tests/core/organization.behavior.test.ts \
  tests/core/property.behavior.test.ts \
  tests/core/room.behavior.test.ts \
  tests/conformance/erd3/identity-organization.contract.test.ts \
  tests/conformance/erd3/property-room.lifecycle.test.ts \
  tests/conformance/erd3/future-open-boundary.static.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run:

```bash
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 3: Run full ERD3 conformance**

Run:

```bash
pnpm test:conformance:erd3
```

Expected: Identity/Organization/Property/Room/FUTURE-surface assertions PASS; Listing/Tenancy/Finance/Incident/Trust assertions remain RED only for domains not rebuilt yet.

- [ ] **Step 4: Run full backend tests**

Run:

```bash
pnpm test
```

Expected: no compile/import/harness errors. Failures are allowed only where they correspond to intentionally unrebuilt ERD3 domains or obsolete tests not touched by this plan; every observed failure must be named in the audit.

- [ ] **Step 5: Run frozen database validators unchanged**

Run:

```bash
python -m unittest discover -s tests/database -p "test_*.py"
```

Expected: PASS. This plan must not modify database authority artifacts to make backend tests pass.

- [ ] **Step 6: Update the RED-baseline audit with observed core results**

Mark Identity/Organization/Property/Room and FUTURE runtime-surface rows with observed PASS/FAIL. Do not mark Listing/Tenancy/Finance/Incident/Trust as implemented. Record any remaining full-suite failures by exact test name and owning future rebuild plan.

- [ ] **Step 7: Commit**

```bash
git add docs/audits/2026-09-28-erd3-conformance-red-baseline.md tests/conformance/erd3/README.md
git commit -m "docs: record ERD3 core backend reconciliation status"
```

---

## Completion Gate

This plan is complete only when:

```text
[PASS] USER has no global business role/current role-assignment invitation surface.
[PASS] Organization carries one immutable primary owner reference and no stale status lifecycle.
[PASS] Property has separate operational/public location and guarded ACTIVE→ARCHIVED lifecycle.
[PASS] Room has dual operational/record state, no room-owned rent, and correct ERD3 FSM.
[PASS] Subscription and batch onboarding are not registered as CURRENT runtime modules.
[PASS] focused core behavior tests.
[PASS] focused ERD3 conformance for core domains.
[PASS] pnpm typecheck.
[PASS] frozen database validators unchanged.
[RED by design] unrebuilt Listing/Tenancy/Finance/Incident/Trust conformance may still fail.
[DOCUMENTED] every remaining RED belongs to a later rebuild plan.
```

No migration/schema work starts after this plan. The next backend-only plan is `Listing + Inquiry + Tenancy + Participant + Terms + Notice`, followed by Finance, then Incident/Trust/Notification, then auth hardening. Persistence/migrations remain deferred until those domain contracts converge.