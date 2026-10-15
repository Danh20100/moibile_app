# ERD3 Authority and Conformance Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Canonical v3.7 / frozen ERD3 the unambiguous repository authority and install an intentionally RED ERD3 conformance suite that exposes the pre-ERD3 backend contracts before domain code is rebuilt.

**Architecture:** This plan implements only Stage A (authority convergence) and Stage B (ERD3 conformance RED suite) from the approved reconciliation design. Documentation is corrected first, then tests are added around frozen semantic boundaries rather than existing module boundaries; the tests may use static source inspection where the desired runtime interface does not yet exist, and are later replaced or strengthened by behavioral tests during domain rebuild.

**Tech Stack:** NestJS 12, TypeScript 6, Node.js `node:test` via `tsx`, pnpm, existing Python ERD3 validators, PostgreSQL/PostGIS reference artifacts.

**Spec:** `docs/superpowers/specs/2026-09-28-erd3-backend-reconciliation-design.md`

## Global Constraints

- Authority order is `docs/database/canonical-v3.7.md` → ERD LV1 → ERD LV2 → ERD LV3 → validated PostgreSQL/PostGIS reference DDL → migration/persistence/backend.
- If implementation or lower-level documentation conflicts with a frozen invariant, implementation/documentation changes; ERD3 is not weakened to preserve old behavior.
- Do not choose an ORM, create runtime migrations, or implement the persistence layer in this plan.
- Do not close any Canonical `[OPEN]` policy in docs, tests, DTOs, guards, or defaults.
- Do not promote `[FUTURE]` capabilities to current core in order to preserve existing scaffolding.
- Old backend contracts and tests may be broken intentionally when they encode superseded semantics; no compatibility adapter is required for unpublished APIs.
- PostgreSQL/PostGIS remains the target persistence platform, but this plan does not change the validated LV3 schema artifacts.
- During the controlled RED stage, `pnpm test` is expected to fail because `tests/conformance/erd3/*.test.ts` is included by the existing test glob. `pnpm typecheck` and the database validation suite must remain green.

## Review Focus

1. **Stale prose survives outside the top-level docs:** module READMEs/ARCHITECTURE files must not continue to teach `Room draft`, `Listing hidden/rented`, direct `Active → Ended`, Receipt-as-payment, or old Incident states after authority convergence.
2. **False-green conformance:** a conformance test must fail because an old semantic is present, not because of an import error, missing fixture, path error, or TypeScript syntax failure.
3. **OPEN policy collapse:** tests may assert that an OPEN item remains explicitly unresolved, but must not decide the policy on behalf of Canonical v3.7.
4. **FUTURE scope leakage:** Subscription/Pricing/Quota and CSV/Excel import must not be described or registered as current core merely because old modules exist.
5. **Structure-coupled tests:** conformance tests must assert business semantics, not require one Nest module per ERD table or freeze a folder layout that the approved design intentionally leaves flexible.

---

### Task 1: Converge repository-level authority and reading order

**Files:**
- Modify: `README.md`
- Modify: `docs/PROJECT_CONTEXT.md`
- Modify: `docs/SYSTEM_CONTEXT.md`
- Modify: `docs/USE_CASES.md`
- Modify: `docs/SYSTEM_STRUCTURE_IMPLEMENTATION.md`

**Interfaces:**
- Consumes: frozen authority chain from `docs/database/README.md`, `docs/database/canonical-v3.7.md`, `docs/database/erd/README.md`.
- Produces: one repository reading order and one shared vocabulary that all module docs/tests can cite.

- [ ] **Step 1: Record the stale repository-level terms before editing**

Run:

```bash
rg -n "Receipt.*payment|payment.*Receipt|subscription|CSV|Excel|hidden|rented|need_more_information|processing|draft.*vacant|active.*ended" README.md docs/PROJECT_CONTEXT.md docs/SYSTEM_CONTEXT.md docs/USE_CASES.md docs/SYSTEM_STRUCTURE_IMPLEMENTATION.md
```

Expected: hits that demonstrate pre-ERD3 semantics, including the old `Receipt`/payment framing and old lifecycle/scope language.

- [ ] **Step 2: Update `README.md` reading order**

Make the first domain-authority links point to:

```text
docs/database/canonical-v3.7.md
docs/database/erd/README.md
docs/database/erd/trooi-erd-lv1-conceptual.json
docs/database/erd/trooi-erd-lv2-logical.json
docs/database/erd/trooi-erd-lv3-physical.json
docs/PROJECT_CONTEXT.md
docs/USE_CASES.md
docs/SYSTEM_CONTEXT.md
```

State that lower-level docs/code lose on conflict with frozen invariants.

- [ ] **Step 3: Rewrite project/system context around ERD3 ownership**

`docs/PROJECT_CONTEXT.md` and `docs/SYSTEM_CONTEXT.md` must describe the current core with these ownership boundaries:

```text
USER = digital identity, no global landlord/tenant role
ORGANIZATION = rental operating workspace with one primary owner reference
PROPERTY = property identity + lifecycle + operational/public location boundary
ROOM = identity + operational_state + record_lifecycle
LISTING = public discovery projection
TENANCY = rental relationship
TENANCY_PARTICIPANT = participation, optional USER link
TENANCY_TERMS = versioned agreed terms
BILLING_CYCLE/CHARGE = receivable obligation
PAYMENT = actual money inflow
RECEIPT = evidence of confirmed Payment
DEPOSIT = fulfillment/holding/settlement
INCIDENT = problem lifecycle, with append-only IncidentEvent history
```

Classify Subscription/Pricing/Quota and CSV/Excel import as FUTURE, not current core.

- [ ] **Step 4: Reconcile `docs/USE_CASES.md`**

Remove or rewrite use cases that treat Receipt as payment truth, Listing `hidden/rented` as canonical lifecycle, old Incident states as canonical, or subscription/import as current-domain requirements. Preserve only behavior supported by Canonical v3.7; where a policy is `[OPEN]`, label it unresolved instead of inventing a choice.

- [ ] **Step 5: Mark the old implementation report historical**

At the top of `docs/SYSTEM_STRUCTURE_IMPLEMENTATION.md`, add an explicit historical/superseded banner stating that pre-ERD3 lifecycle descriptions are not current authority and linking to Canonical v3.7 + the approved reconciliation spec.

- [ ] **Step 6: Verify repository-level docs no longer present stale semantics as current**

Run the `rg` command from Step 1 again and inspect every remaining hit.

Expected: remaining hits are only historical notes, explicit FUTURE scope, or explanatory comparisons clearly marked as superseded; no stale term is presented as current authority.

- [ ] **Step 7: Commit**

```bash
git add README.md docs/PROJECT_CONTEXT.md docs/SYSTEM_CONTEXT.md docs/USE_CASES.md docs/SYSTEM_STRUCTURE_IMPLEMENTATION.md
git commit -m "docs: align project authority with ERD3"
```

---

### Task 2: Converge module documentation without preserving obsolete contracts

**Files:**
- Modify: `src/modules/identity-access/README.md`
- Modify: `src/modules/identity-access/ARCHITECTURE.md`
- Modify: `src/modules/organization/README.md`
- Modify: `src/modules/organization/ARCHITECTURE.md`
- Modify: `src/modules/property/README.md`
- Modify: `src/modules/property/ARCHITECTURE.md`
- Modify: `src/modules/room/README.md`
- Modify: `src/modules/room/ARCHITECTURE.md`
- Modify: `src/modules/listing/README.md`
- Modify: `src/modules/listing/ARCHITECTURE.md`
- Modify: `src/modules/tenancy/README.md`
- Modify: `src/modules/tenancy/ARCHITECTURE.md`
- Modify: `src/modules/billing/README.md`
- Modify: `src/modules/billing/ARCHITECTURE.md`
- Modify: `src/modules/receipt/README.md`
- Modify: `src/modules/receipt/ARCHITECTURE.md`
- Modify: `src/modules/incident/README.md`
- Modify: `src/modules/incident/ARCHITECTURE.md`
- Modify: `src/modules/audit-trust/README.md`
- Modify: `src/modules/audit-trust/ARCHITECTURE.md`
- Modify: `src/modules/subscription/README.md`
- Modify: `src/modules/subscription/ARCHITECTURE.md`
- Modify: `src/modules/onboarding/README.md`
- Modify: `src/modules/onboarding/ARCHITECTURE.md`

**Interfaces:**
- Consumes: repository authority from Task 1.
- Produces: module docs that describe target ownership/semantics while openly stating where code is temporarily pre-ERD3.

- [ ] **Step 1: Add a shared authority note to every touched module doc**

The note must link to `docs/database/canonical-v3.7.md` and state that code examples/lifecycles in the module doc cannot override frozen ERD3 invariants.

- [ ] **Step 2: Correct Identity, Organization, Property, and Room documentation**

Pin these semantics:

```text
USER: no global owner/operator/tenant business role
ORGANIZATION: one primary owner reference in MVP; advanced team/delegation is FUTURE
PROPERTY: ACTIVE | ARCHIVED; archive blockers are guarded workflow, not unrestricted status patch
ROOM operational_state: VACANT | OCCUPIED | MAINTENANCE | INACTIVE
ROOM record_lifecycle: ACTIVE | ARCHIVED
ROOM does not own rent price; OCCUPIED → MAINTENANCE and OCCUPIED → INACTIVE are invalid
ROOM archive requires INACTIVE plus no non-terminal Tenancy plus no open Incident
```

- [ ] **Step 3: Correct Listing and Tenancy documentation**

Pin these semantics:

```text
LISTING: DRAFT | PUBLISHED | UNPUBLISHED | ARCHIVED
publish requires VACANT active Room under active Property
Room leaving VACANT synchronously unpublishes current Listing
at most one current/non-archived Listing per Room
TENANCY: DRAFT | ACTIVE | ENDING | ENDED | CANCELLED
DRAFT → ACTIVE | CANCELLED
ACTIVE → ENDING
ENDING → ACTIVE | ENDED
at most one non-terminal Tenancy per Room
no next DRAFT Tenancy while current Tenancy is ENDING
participant is distinct from USER and USER link is optional
terms are first-class/versioned; acknowledgement is version-specific
confirmed checkout atomically ends Tenancy and returns Room to VACANT
```

- [ ] **Step 4: Correct Billing and Receipt documentation**

Pin financial ownership:

```text
BillingCycle → Charge
Payment → PaymentAllocation → Charge
Payment → DepositPaymentApplication → Deposit
Payment → Receipt
```

Remove `applyPaymentOutcome()` and mutable cycle paid/outstanding fields as authoritative truth. Describe them only as possible derived/read projections. Receipt must not be described as the Payment record. State that only confirmed Payment counts, Receipt is issued only from confirmed Payment, allocation/application cannot cross Tenancy, and allocation + deposit application total cannot exceed Payment amount.

- [ ] **Step 5: Correct Incident and Trust documentation**

Pin Incident categories and lifecycle exactly:

```text
ELECTRICAL | PLUMBING | ACCESS_SECURITY | ROOM_FACILITY | APPLIANCE | OTHER
REPORTED → ACKNOWLEDGED | REJECTED | CLOSED
ACKNOWLEDGED → IN_PROGRESS | REJECTED
IN_PROGRESS → RESOLVED | CLOSED
RESOLVED → CLOSED | IN_PROGRESS
REJECTED and CLOSED terminal
```

State that IncidentEvent is append-only. TrustReport targets exactly one Listing or Review. Keep login/rate-limit/moderation/evidence policy explicitly OPEN.

- [ ] **Step 6: Reclassify Subscription and import-related Onboarding docs**

`src/modules/subscription/*` must say the implementation is pre-ERD3 scaffolding for a FUTURE capability and not current-core authority. `src/modules/onboarding/*` may retain manual orchestration for creating current Property/Room data, but must not present CSV/Excel import as current core; CSV/Excel import remains FUTURE.

- [ ] **Step 7: Verify stale lifecycle/scope prose is gone from current-authority sections**

Run:

```bash
rg -n "hidden|rented|need_more_information|processing|recorded.*confirmed|applyPaymentOutcome|RoomStatus.*draft|occupied.*maintenance|active.*ended|CSV|Excel|subscription" src/modules/*/README.md src/modules/*/ARCHITECTURE.md
```

Expected: every remaining hit is either an explicit superseded-code warning or FUTURE classification; no current architecture section teaches the old semantics.

- [ ] **Step 8: Commit**

```bash
git add src/modules/*/README.md src/modules/*/ARCHITECTURE.md
git commit -m "docs: align module contracts with ERD3"
```

---

### Task 3: Install the ERD3 conformance harness and authority tests

**Files:**
- Modify: `package.json`
- Create: `tests/conformance/erd3/README.md`
- Create: `tests/conformance/erd3/support/source.ts`
- Create: `tests/conformance/erd3/authority.static.test.ts`

**Interfaces:**
- Consumes: Task 1/2 authority docs.
- Produces:
  - `readRepoFile(relativePath: string): string`
  - `readRepoFiles(relativePaths: readonly string[]): string`
  - `assertContainsAll(source: string, tokens: readonly string[]): void`
  - `assertContainsNone(source: string, tokens: readonly string[]): void`
  - `pnpm test:conformance:erd3`

- [ ] **Step 1: Add the conformance test script**

Add to `package.json`:

```json
"test:conformance:erd3": "tsx --test tests/conformance/erd3/*.test.ts"
```

Do not change the existing `test` glob; the whole backend suite is intentionally RED while conformance failures exist.

- [ ] **Step 2: Create source-inspection helpers**

In `tests/conformance/erd3/support/source.ts`, expose exactly:

```ts
export function readRepoFile(relativePath: string): string;
export function readRepoFiles(relativePaths: readonly string[]): string;
export function assertContainsAll(source: string, tokens: readonly string[]): void;
export function assertContainsNone(source: string, tokens: readonly string[]): void;
```

Resolve paths from `process.cwd()`. Helpers must throw/assert with the missing or forbidden token in the message so RED failures identify the semantic drift rather than a generic boolean mismatch.

- [ ] **Step 3: Write authority tests that should already pass after Tasks 1–2**

`authority.static.test.ts` must include these assertions:

```ts
test('repository reading order places Canonical v3.7 and frozen ERDs before implementation docs', ...);
test('historical implementation report declares pre-ERD3 lifecycles superseded', ...);
test('module docs defer to frozen ERD3 authority', ...);
test('current docs do not describe Receipt as payment truth', ...);
test('FUTURE subscription and CSV/Excel import are not documented as current core', ...);
```

The tests must read repository files rather than duplicate the documents into fixtures.

- [ ] **Step 4: Create the conformance README**

Document:

```text
Purpose: semantic bridge between frozen ERD3 and backend
Initial state: intentionally RED against pre-ERD3 code
Allowed static tests: only where desired runtime interface is not yet stable
Migration rule: replace/strengthen static checks with behavioral tests when rebuilt interfaces exist
Failure rule: syntax/import/path failures are defects in the test suite, not acceptable RED evidence
No folder-layout rule: tests assert domain semantics, not one module per ERD table
```

- [ ] **Step 5: Run authority-only test and typecheck**

Run:

```bash
pnpm exec tsx --test tests/conformance/erd3/authority.static.test.ts
pnpm typecheck
```

Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json tests/conformance/erd3/README.md tests/conformance/erd3/support/source.ts tests/conformance/erd3/authority.static.test.ts
git commit -m "test: add ERD3 conformance harness"
```

---

### Task 4: Add RED Identity / Organization / Property / Room conformance tests

**Files:**
- Create: `tests/conformance/erd3/identity-organization.contract.test.ts`
- Create: `tests/conformance/erd3/property-room.lifecycle.test.ts`

**Interfaces:**
- Consumes: helper functions from Task 3.
- Produces: stable semantic failures for the first core rebuild slice; no new product interface.

- [ ] **Step 1: Write Identity and Organization RED tests**

Pin these assertions:

```ts
test('USER contract has no global business role', () => {
  // identity contract must not define UserRole or UserProfile.role
});

test('ORGANIZATION contract carries the primary owner reference', () => {
  // organization contract must expose a primary-owner concept/reference
});

test('old OrganizationStatus active inactive archived is not treated as ERD3 source truth', () => {
  // ERD3 freezes primary ownership but does not freeze the old generic organization lifecycle
});
```

Expected on old backend: FAIL because `UserRole`, optional `role`, missing primary owner, and the pre-ERD3 `OrganizationStatus` contract are present.

- [ ] **Step 2: Run Identity/Organization tests to verify semantic RED**

Run:

```bash
pnpm exec tsx --test tests/conformance/erd3/identity-organization.contract.test.ts
```

Expected: FAIL only on the three named semantic assertions; no import/path/syntax failure.

- [ ] **Step 3: Write Property/Room RED tests**

Pin these assertions:

```ts
test('PROPERTY lifecycle is ACTIVE ARCHIVED only', ...);
test('PROPERTY exposes both operational and public location concepts', ...);
test('ROOM separates operational state from record lifecycle', ...);
test('ROOM operational states are VACANT OCCUPIED MAINTENANCE INACTIVE only', ...);
test('ROOM record lifecycle is ACTIVE ARCHIVED only', ...);
test('ROOM contract does not own base rent price', ...);
test('old OCCUPIED to MAINTENANCE transition is not allowed', ...);
test('room archival is not represented as a direct operational-state transition', ...);
test('room archive guard requires INACTIVE and blocks nonterminal tenancy or open incident', ...);
```

Use case-insensitive semantic token checks where naming style is not frozen. The archive-guard test is allowed to remain RED until the later transaction-guard plan; it must not prescribe ORM or folder structure.

- [ ] **Step 4: Run Property/Room tests to verify semantic RED**

Run:

```bash
pnpm exec tsx --test tests/conformance/erd3/property-room.lifecycle.test.ts
```

Expected: FAIL on known old Room/Property contract semantics; helper infrastructure remains green.

- [ ] **Step 5: Run typecheck**

Run:

```bash
pnpm typecheck
```

Expected: PASS. RED evidence must come from test assertions, not compilation failures.

- [ ] **Step 6: Commit**

```bash
git add tests/conformance/erd3/identity-organization.contract.test.ts tests/conformance/erd3/property-room.lifecycle.test.ts
git commit -m "test: expose ERD3 identity and room drift"
```

---

### Task 5: Add RED Listing and Tenancy conformance tests

**Files:**
- Create: `tests/conformance/erd3/listing.contract.test.ts`
- Create: `tests/conformance/erd3/tenancy.contract.test.ts`

**Interfaces:**
- Consumes: helper functions from Task 3.
- Produces: semantic failure contract for Listing/Tenancy rebuild.

- [ ] **Step 1: Write Listing RED tests**

Pin these assertions:

```ts
test('LISTING lifecycle is DRAFT PUBLISHED UNPUBLISHED ARCHIVED only', ...);
test('LISTING no longer uses hidden or rented states', ...);
test('LISTING does not duplicate Property ownership beside Room ownership', ...);
test('publishing is coupled to Room vacancy and active Property eligibility', ...);
test('Room leaving VACANT has an explicit synchronous unpublish workflow', ...);
test('Room has at most one current non-archived Listing', ...);
test('listing status change has a first-class event/history concept', ...);
```

For orchestration/guard assertions, inspect the current Listing/Room source tree for semantic evidence without requiring a future folder layout. The old backend should fail because publish only checks record existence, Listing stores `propertyId`, and no status-event/synchronous unpublish/current-listing guard exists.

- [ ] **Step 2: Verify Listing tests are RED for semantics**

Run:

```bash
pnpm exec tsx --test tests/conformance/erd3/listing.contract.test.ts
```

Expected: FAIL on the listed frozen requirements, not test harness errors.

- [ ] **Step 3: Write Tenancy RED tests**

Pin these assertions:

```ts
test('TENANCY lifecycle includes CANCELLED and forbids direct ACTIVE to ENDED', ...);
test('DRAFT tenancy may cancel', ...);
test('ENDING tenancy may return to ACTIVE or complete to ENDED', ...);
test('TENANCY does not embed tenantId as participant truth', ...);
test('TenancyParticipant is a first-class concept with optional USER link', ...);
test('TenancyTerms is first-class and versioned rather than embedded mutable terms', ...);
test('Terms acknowledgement is version-specific', ...);
test('Room has at most one non-terminal Tenancy', ...);
test('ENDING tenancy blocks creation of a next DRAFT tenancy for the Room', ...);
test('checkout workflow couples ENDING to ENDED with Room becoming VACANT', ...);
```

Do not assert one table/module per concept; search the Tenancy bounded-context source tree for the concepts. The max-one/nonterminal and checkout atomicity assertions may remain RED until transaction-safe implementation exists.

- [ ] **Step 4: Verify Tenancy tests are RED for semantics**

Run:

```bash
pnpm exec tsx --test tests/conformance/erd3/tenancy.contract.test.ts
```

Expected: FAIL on old direct `tenantId`, embedded `terms`, missing CANCELLED/participant/versioning/checkout orchestration/room guard, and old direct ACTIVE→ENDED transition.

- [ ] **Step 5: Run typecheck**

Run:

```bash
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add tests/conformance/erd3/listing.contract.test.ts tests/conformance/erd3/tenancy.contract.test.ts
git commit -m "test: expose ERD3 listing and tenancy drift"
```

---

### Task 6: Add RED Finance / Incident / Trust / scope-boundary conformance tests

**Files:**
- Create: `tests/conformance/erd3/finance.contract.test.ts`
- Create: `tests/conformance/erd3/incident.contract.test.ts`
- Create: `tests/conformance/erd3/trust.contract.test.ts`
- Create: `tests/conformance/erd3/future-open-boundary.static.test.ts`

**Interfaces:**
- Consumes: helper functions from Task 3.
- Produces: remaining initial semantic RED contract without selecting persistence tooling.

- [ ] **Step 1: Write Finance RED tests**

Pin these assertions:

```ts
test('current charge types are RENT ELECTRICITY WATER only', ...);
test('Payment is a first-class actual-inflow concept belonging to exactly one Tenancy', ...);
test('PaymentAllocation and DepositPaymentApplication are distinct first-class concepts', ...);
test('allocation and deposit application cannot cross Tenancy', ...);
test('allocation plus deposit application cannot exceed Payment amount', ...);
test('confirmed Payment is corrected by void reverse plus a new Payment rather than destructive edit', ...);
test('Receipt is evidence attached to confirmed Payment and uses ISSUED VOIDED lifecycle', ...);
test('Receipt is not the payment record', ...);
test('billing source of truth does not mutate paidAmount outstanding via applyPaymentOutcome', ...);
test('deposit requirement is separated from deposit fulfillment and settlement', ...);
```

The tests may inspect the combined Billing/Receipt/source tree because the future bounded-context folder name is not frozen. They must not require a `finance/` directory. Amount-cap/cross-tenancy/correction assertions may initially be semantic/static RED checks and must be replaced with behavioral transaction/concurrency tests during the persistence-guards plan.

- [ ] **Step 2: Verify Finance tests are RED**

Run:

```bash
pnpm exec tsx --test tests/conformance/erd3/finance.contract.test.ts
```

Expected: FAIL on missing Payment/allocation/deposit concepts, arbitrary charge type, old `applyPaymentOutcome`, and Receipt `recorded/confirmed` semantics.

- [ ] **Step 3: Write Incident RED tests**

Pin exact semantic sets:

```ts
const categories = ['ELECTRICAL', 'PLUMBING', 'ACCESS_SECURITY', 'ROOM_FACILITY', 'APPLIANCE', 'OTHER'];
const statuses = ['REPORTED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED', 'CLOSED'];
```

Tests must reject old `processing` and `need_more_information`, require `REJECTED`, require `REJECTED` and `CLOSED` to be terminal, require reopen `RESOLVED → IN_PROGRESS`, and require an append-only IncidentEvent/history concept.

- [ ] **Step 4: Verify Incident tests are RED**

Run:

```bash
pnpm exec tsx --test tests/conformance/erd3/incident.contract.test.ts
```

Expected: FAIL on the old lifecycle/category/history model.

- [ ] **Step 5: Write Trust and scope-boundary tests**

`trust.contract.test.ts`:

```ts
test('TrustReport target is exactly Listing or Review', ...);
test('TrustReport is distinct from Incident', ...);
test('trust/review source does not expose a public personal landlord-rating contract', ...);
```

`future-open-boundary.static.test.ts`:

```ts
test('SubscriptionModule is not registered as current core', ...);
test('CSV Excel import is not registered or documented as current core', ...);
test('OPEN policies remain explicitly unresolved rather than assigned a boolean/default choice', ...);
```

For the public-rating assertion, inspect only exported/current trust contracts and docs for personal landlord/user score/rating fields; do not forbid private review content or Property/rental-experience review. For OPEN policy testing, assert preserved `[OPEN]` markers/wording and absence of explicit policy constants/defaults; do **not** assert `public` or `authenticated` as the answer.

- [ ] **Step 6: Verify Trust/scope tests are RED only where old code still violates scope**

Run:

```bash
pnpm exec tsx --test tests/conformance/erd3/trust.contract.test.ts tests/conformance/erd3/future-open-boundary.static.test.ts
```

Expected: Subscription/current trust-target semantics fail; documentation-boundary checks that Tasks 1–2 already corrected may pass.

- [ ] **Step 7: Run typecheck**

Run:

```bash
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add tests/conformance/erd3/finance.contract.test.ts tests/conformance/erd3/incident.contract.test.ts tests/conformance/erd3/trust.contract.test.ts tests/conformance/erd3/future-open-boundary.static.test.ts
git commit -m "test: expose remaining ERD3 semantic drift"
```

---

### Task 7: Freeze the intentional RED baseline and prove existing database authority remains green

**Files:**
- Create: `docs/audits/2026-09-28-erd3-conformance-red-baseline.md`
- Modify: `tests/conformance/erd3/README.md`

**Interfaces:**
- Consumes: all conformance tests from Tasks 3–6.
- Produces: an auditable failure matrix used by later domain-rebuild plans to turn RED assertions green one bounded context at a time.

- [ ] **Step 1: Run the complete conformance suite**

Run:

```bash
pnpm test:conformance:erd3
```

Expected: FAIL, with authority/documentation tests green and product-contract tests red on the known pre-ERD3 semantics. Record every failing test name and the exact old contract it exposes.

- [ ] **Step 2: Run TypeScript typecheck**

Run:

```bash
pnpm typecheck
```

Expected: PASS. Any compile error must be fixed before accepting the RED baseline.

- [ ] **Step 3: Run the existing full backend test command**

Run:

```bash
pnpm test
```

Expected: FAIL because the newly included ERD3 conformance assertions are RED. Existing pre-ERD3 regression tests may still pass at this point; do not rewrite them yet unless they prevent the conformance files from loading.

- [ ] **Step 4: Run the frozen database validator tests unchanged**

Run:

```bash
python -m unittest discover -s tests/database -p "test_*.py"
```

Expected: PASS. If this command is not the repository's existing Python runner, use the documented equivalent without modifying ERD3 artifacts merely to satisfy backend code.

- [ ] **Step 5: Write the RED baseline audit**

`docs/audits/2026-09-28-erd3-conformance-red-baseline.md` must contain a table with:

```text
Test name | Frozen invariant | Current old contract causing RED | Owning future rebuild plan | Status
```

Group failures into:

```text
Identity/Organization
Property/Room
Listing
Tenancy/Terms/Participant
Finance
Incident
Trust
FUTURE/OPEN boundary
```

Do not call a guard/concurrency invariant implemented if the current test only proves concept ownership or source-level intent. Mark deeper transaction/concurrency verification for the later persistence-guards plan.

- [ ] **Step 6: Update the conformance README with baseline rules**

State that later tasks may change a test from static to behavioral, but may not delete a frozen invariant simply to make the suite green. Any deliberate invariant change requires changing the higher authority first.

- [ ] **Step 7: Commit**

```bash
git add docs/audits/2026-09-28-erd3-conformance-red-baseline.md tests/conformance/erd3/README.md
git commit -m "docs: freeze ERD3 conformance red baseline"
```

---

## Completion Gate for This Plan

This plan is complete only when all of the following are true:

```text
[PASS] Canonical v3.7 / ERD3 is first-class repository authority.
[PASS] Project/system/module docs no longer present old contracts as current truth.
[PASS] pnpm typecheck
[PASS] frozen database validator suite
[PASS] authority/documentation conformance tests
[RED by design] product ERD3 conformance tests fail on known semantic mismatches
[DOCUMENTED] every RED failure maps to a frozen invariant and a later rebuild owner
```

Do **not** start changing core domain contracts inside this plan. The next implementation plans consume this RED baseline in this order:

1. Identity / Organization / Property / Room core contracts.
2. Listing / Tenancy / Participant / Terms lifecycle contracts.
3. Financial ledger (Billing/Charge/Payment/Allocation/Deposit/Receipt).
4. Incident / Trust / supporting CURRENT domains.
5. Persistence baseline + all frozen transaction guards/concurrency tests.
6. Authentication/authorization hardening and final integration reconciliation.
