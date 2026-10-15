# Core Foundation Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the current Core Foundation verification fail-closed and trustworthy before the next domain-development wave begins.

**Architecture:** Keep the current domain model unchanged. Add deterministic expected-failure classification around the still-incomplete downstream suites, make completed Core Foundation checks independent hard gates, then harden dependency wiring and DTO validation before re-freezing runtime evidence from a real green GitHub Actions run.

**Tech Stack:** NestJS 12, TypeScript 6, Node 24 test runner, `tsx`, `class-validator`, GitHub Actions, Python unittest database validators.

**Spec:** `docs/superpowers/specs/2026-09-28-core-foundation-hardening-design.md`

## Global Constraints

- Canonical v3.7 remains product/domain authority; ERD LV1/LV2/LV3 are supporting representations only.
- Do not use `ERD3` as a new phase/package name; legacy paths/scripts containing `erd3` remain untouched in this task.
- Do not change database schema, migrations, ORM/persistence, or concurrency design.
- Do not implement Listing, Tenancy, Finance, Incident, Trust, or authorization semantics.
- Identity, Organization, Property, Room, runtime-boundary, typecheck, DB validators, and Google identity must never be allowlisted.
- The expected-failure baseline is exact-set equality, never fuzzy matching or count-only matching.
- Every implementation task follows RED → GREEN → typecheck/regression → commit.
- Final completion requires the GitHub Actions workflow itself to conclude success.

## Review Focus

1. **Baseline drift:** adding one unexpected failing test or removing one expected failing test must both fail classification — pinned in Task 1.
2. **Harness failure:** missing/malformed machine-readable output must fail closed rather than be accepted as product RED — pinned in Task 1.
3. **Parent integrity bypass:** direct service construction must not allow Property/Room creation without real parent validation — pinned in Task 3.
4. **Optional empty strings:** omitted update fields remain valid while supplied `''` values are invalid — pinned in Task 4.
5. **Unrelated full-suite regression:** a failure outside the committed downstream allowlist must make CI fail — pinned in Tasks 1 and 2.

---
### Task 1: F0 — Deterministic expected-failure classifier

**Files:**
- Create: `scripts/verify-test-baseline.mjs`
- Create: `tests/verification/test-baseline-classifier.test.ts`
- Create: `tests/conformance/erd3/expected-failures.json`
- Modify: `package.json`

**Interfaces:**
- Produces CLI: `node scripts/verify-test-baseline.mjs --junit <file> --baseline <file> --suite <label>`.
- Baseline schema: `{ "version": 1, "expectedFailures": [{ "name": string, "owner": string, "reason": string }] }`.
- Classifier exits `0` only when parsed failing testcase names equal the committed baseline exactly; every other condition exits non-zero with expected/observed diff.
- Use Node's built-in **JUnit** reporter as the machine-readable boundary; do not parse the human `spec` reporter.

- [ ] **Step 1: Write classifier tests first**

Create tests named:

```text
accepts exact expected failure set
rejects an unexpected additional failure
rejects a missing expected failure
rejects malformed JUnit
rejects missing JUnit file
rejects duplicate baseline names
rejects malformed baseline entries
rejects fully green result while baseline is non-empty
accepts fully green result only when baseline is empty
```

Use temporary JUnit/baseline files so tests exercise the CLI behavior and exit code, not internal implementation details.

- [ ] **Step 2: Run RED**

Run: `pnpm exec tsx --test tests/verification/test-baseline-classifier.test.ts`

Expected: FAIL because `scripts/verify-test-baseline.mjs` and baseline contract do not yet exist.
- [ ] **Step 3: Implement the classifier CLI**

Implement argument parsing and exact-set comparison in `scripts/verify-test-baseline.mjs`.

Requirements:

```text
read JUnit XML from --junit
extract testcase elements that contain failure/error children
XML-decode testcase names before comparing
load and validate baseline JSON
normalize by exact trimmed testcase name only
reject duplicate names in either observed failures or baseline
print missing-expected and unexpected-observed names separately
fail if JUnit has no valid testsuite/testcase structure
```

Do not add an XML package unless the built-in reporter output proves impossible to parse safely with a small focused parser.

- [ ] **Step 4: Seed the current downstream expected-failure baseline**

Populate `tests/conformance/erd3/expected-failures.json` with exactly the 30 currently documented downstream failures from `docs/audits/2026-09-28-erd3-conformance-red-baseline.md`:

```text
Wave B Listing/Tenancy: 14
Wave C Finance: 10
Wave D Incident/Trust: 6
```

Copy exact test names from the audit; do not paraphrase them. Give every entry its owner and a short reason such as `domain rebuild intentionally deferred to Wave B`.

- [ ] **Step 5: Add machine-readable test scripts without replacing legacy scripts**

Add these exact package-script responsibilities (equivalent quoting is fine if required by Windows `cmd.exe`):

```text
test:core-foundation = tsx --test tests/core/organization.behavior.test.ts tests/core/property.behavior.test.ts tests/core/room.behavior.test.ts tests/conformance/erd3/identity.contract.test.ts tests/conformance/erd3/organization.contract.test.ts tests/conformance/erd3/property-room.lifecycle.test.ts tests/conformance/erd3/future-open-boundary.static.test.ts

test:domain-contract:junit = node --import tsx --test --test-reporter=junit --test-reporter-destination=domain-contract.junit.xml "tests/conformance/erd3/*.test.ts"

test:full:junit = nest build && node --import tsx --test --test-reporter=junit --test-reporter-destination=full-test.junit.xml "src/**/*.spec.ts" "tests/**/*.test.ts"

verify:test-baseline = node scripts/verify-test-baseline.mjs
```

The JUnit commands must run successfully on both the existing Windows development environment and the Ubuntu GitHub runner. If Node's quoted glob handling differs, preserve the exact test scope while adjusting only the invocation syntax.

Keep `test:conformance:erd3` and `test` unchanged for compatibility.

- [ ] **Step 6: Run GREEN and regression checks**

Run:

```bash
pnpm exec tsx --test tests/verification/test-baseline-classifier.test.ts
pnpm typecheck
```

Expected: classifier tests PASS; typecheck PASS.

- [ ] **Step 7: Commit F0**

```bash
git add scripts/verify-test-baseline.mjs tests/verification/test-baseline-classifier.test.ts tests/conformance/erd3/expected-failures.json package.json
git commit -m "test: add deterministic domain failure baseline"
```

---
### Task 2: F1 — Make Core Foundation an independent CI hard gate

**Files:**
- Modify: `.github/workflows/backend-erd3-conformance.yml`
- Modify: `package.json` only if Task 1 script names need final alignment

**Interfaces:**
- Consumes `pnpm test:core-foundation`, `pnpm test:domain-contract:junit`, `pnpm test:full:junit`, and the classifier CLI from Task 1.
- Produces a workflow that is GREEN when all hard gates pass and both classified suites match the expected baseline exactly.

- [ ] **Step 1: Add a static workflow regression test or focused source assertion**

Extend `tests/verification/test-baseline-classifier.test.ts` or add `tests/verification/core-foundation-workflow.test.ts` to assert the workflow contains hard-gate steps for:

```text
pnpm test:core-foundation
pnpm typecheck
python -m unittest discover -s tests/database -p 'test_*.py'
Google identity verifier regression
```

Also assert the old grep heuristic (`not ok`, `# fail`, broad `ERD3` matching) is no longer used to classify expected failures.

- [ ] **Step 2: Run RED**

Run: `pnpm exec tsx --test tests/verification/*.test.ts`

Expected: FAIL because the workflow still contains the reporter-dependent grep path and lacks the full hard gate.

- [ ] **Step 3: Rebuild workflow ordering**

Required order:

```text
checkout/setup/install
Typecheck
Core Foundation hard gate
Database validators
Google identity verifier regression
Domain-contract JUnit run (continue-on-error only for raw test command)
Domain-contract exact baseline classifier (must pass)
Full repository JUnit run (continue-on-error only for raw test command)
Full repository exact baseline classifier (must pass)
Upload JUnit/log evidence always
```

Only the two raw baseline-classified test commands may use `continue-on-error: true`; classifier steps and all hard gates must fail normally.

- [ ] **Step 4: Ensure artifact evidence includes both machine-readable suites**

Upload at minimum:

```text
domain-contract.junit.xml
full-test.junit.xml
```

Include human-readable logs only if useful; they are diagnostic, not classification authority.

- [ ] **Step 5: Run GREEN locally for source/config tests**

Run:

```bash
pnpm exec tsx --test tests/verification/*.test.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit F1**

```bash
git add .github/workflows/backend-erd3-conformance.yml package.json tests/verification
git commit -m "ci: harden core foundation verification gates"
```

---
### Task 3: F2 — Require parent dependencies and remove integrity bypasses

**Files:**
- Modify: `src/modules/property/services/property.service.ts`
- Modify: `src/modules/room/services/room.service.ts`
- Create: `tests/core/support/core-foundation.harness.ts`
- Modify: `tests/core/property.behavior.test.ts`
- Modify: `tests/core/room.behavior.test.ts`
- Modify: any other direct-construction tests found by repository search

**Interfaces:**
- `PropertyService` requires `OrganizationService` in its constructor.
- `RoomService` requires `PropertyService` in its constructor.
- Test helper produces `{ organizationService, propertyService, roomService }` with the real in-memory dependency chain.

- [ ] **Step 1: Locate every direct constructor call**

Run:

```bash
git grep -n -E "new (PropertyService|RoomService)\(" -- "*.ts"
```

Record every test/callsite that must be updated; do not leave a hidden optional-construction path.

- [ ] **Step 2: Write/strengthen RED behavior tests**

Add coverage proving:

```text
Property creation with a missing organization is rejected through the normal direct-service harness
Room creation with a missing property is rejected through the normal direct-service harness
all existing Property behavior tests use a real OrganizationService parent
all existing Room behavior tests use a real PropertyService parent
```

- [ ] **Step 3: Run RED**

Run:

```bash
pnpm exec tsx --test tests/core/property.behavior.test.ts tests/core/room.behavior.test.ts
```

Expected: RED until constructors and fixtures stop depending on optional parent services.

- [ ] **Step 4: Make dependency injection mandatory**

Remove `@Optional()` behavior from both parent dependencies. Keep the existing Nest module graph; do not add repository ports, persistence abstractions, or new architecture layers.

Implement test helper:

```ts
createCoreFoundationHarness(): {
  organizationService: OrganizationService;
  propertyService: PropertyService;
  roomService: RoomService;
}
```

Update tests to create required parent records explicitly before child records.

- [ ] **Step 5: Run GREEN and cross-module regressions**

Run:

```bash
pnpm exec tsx --test tests/core/property.behavior.test.ts tests/core/room.behavior.test.ts
pnpm exec tsx --test tests/audit/low-level-architecture/cross-module.integrity.test.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit F2**

```bash
git add src/modules/property/services/property.service.ts src/modules/room/services/room.service.ts tests/core tests/audit/low-level-architecture/cross-module.integrity.test.ts
git commit -m "refactor: require core parent dependencies"
```

---
### Task 4: F3 — Reject supplied empty update strings

**Files:**
- Modify: `src/modules/organization/dto/index.ts`
- Modify: `src/modules/property/dto/index.ts`
- Modify: `src/modules/room/dto/index.ts`
- Create: `tests/core/dto-boundary.validation.test.ts`
- Modify: `package.json`

**Interfaces:**
- Update fields remain optional.
- When present, `UpdateOrganizationDto.name`, `UpdatePropertyDto.name`, `UpdatePropertyDto.operationalAddressText`, and `UpdateRoomDto.nameOrLabel` must reject `''` through `class-validator`.
- No trimming/whitespace normalization policy is introduced in this task.

- [ ] **Step 1: Write validator-level RED tests**

Use `class-validator` against actual DTO instances. Cover each target field with three cases:

```text
field omitted       -> valid
field = ''          -> invalid
field = normal text -> valid
```

Do not use source-text regex as the primary proof.

- [ ] **Step 2: Run RED**

Run: `pnpm exec tsx --test tests/core/dto-boundary.validation.test.ts`

Expected: FAIL because empty strings are currently accepted on at least the listed update fields.

- [ ] **Step 3: Add minimal DTO validation**

Add `@IsNotEmpty()` to the listed optional string fields while preserving `@IsOptional()` and existing string validation.

Do not change lifecycle, ownership, coordinate, or business semantics.

- [ ] **Step 4: Add DTO validation to the permanent Core Foundation hard gate**

Append `tests/core/dto-boundary.validation.test.ts` to the `test:core-foundation` package script created in Task 1 so F3 cannot regress without breaking CI.

- [ ] **Step 5: Run GREEN and affected behavior tests**

Run:

```bash
pnpm exec tsx --test tests/core/dto-boundary.validation.test.ts tests/core/organization.behavior.test.ts tests/core/property.behavior.test.ts tests/core/room.behavior.test.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit F3**

```bash
git add src/modules/organization/dto/index.ts src/modules/property/dto/index.ts src/modules/room/dto/index.ts tests/core/dto-boundary.validation.test.ts package.json
git commit -m "fix: reject empty core update fields"
```

---
### Task 5: F4 — Execute fresh runtime verification

**Files:**
- No production file changes expected.
- Generated local evidence: `domain-contract.junit.xml`, `full-test.junit.xml` (do not commit unless repository policy explicitly requires it).

**Interfaces:**
- Consumes all scripts/gates from Tasks 1–4.
- Produces fresh local and GitHub Actions evidence for the exact implementation commit.

- [ ] **Step 1: Run the complete local hard-gate sequence**

Run in this order:

```bash
pnpm test:core-foundation
pnpm typecheck
python -m unittest discover -s tests/database -p "test_*.py"
pnpm exec tsx --test src/integrations/google-identity/google-id-token-verifier.spec.ts
```

Expected: every command PASS with zero accepted failures.

- [ ] **Step 2: Run domain-contract suite and classify it**

Run `pnpm test:domain-contract:junit`. The raw test command is expected to exit non-zero while downstream domains remain incomplete.

Then run:

```bash
node scripts/verify-test-baseline.mjs --junit domain-contract.junit.xml --baseline tests/conformance/erd3/expected-failures.json --suite domain-contract
```

Expected: classifier PASS with exact equality to the committed downstream baseline.

- [ ] **Step 3: Run full repository suite and classify it**

Run `pnpm test:full:junit`, then:

```bash
node scripts/verify-test-baseline.mjs --junit full-test.junit.xml --baseline tests/conformance/erd3/expected-failures.json --suite full-repository
```

Expected: classifier PASS; no unrelated failure is accepted.

- [ ] **Step 4: Push implementation commits and observe GitHub Actions**

Push `backend/core-foundations`, wait for the `Backend ERD3 Conformance` legacy-named workflow to finish, and record:

```text
final tested commit SHA
workflow run ID
workflow URL
artifact ID/name
step conclusions
```

The workflow name is legacy and is not renamed in this package.

- [ ] **Step 5: Require overall CI GREEN**

Do not proceed to F5 if the workflow conclusion is anything except `success`.

If CI fails, classify the failure as:

```text
hard-gate regression
baseline mismatch
reporter/classifier defect
infrastructure/harness defect
```

Fix the owning task, rerun local verification, commit, push, and obtain a new green run before continuing.

---
### Task 6: F5 — Re-freeze Core Foundation runtime evidence

**Files:**
- Modify: `docs/audits/2026-09-28-erd3-conformance-red-baseline.md` (legacy filename retained intentionally)
- Optionally update the active handoff status block if execution is performed from the handoff file.

**Interfaces:**
- Consumes the exact successful SHA/run/artifact from Task 5.
- Produces a trustworthy Core Foundation freeze record; it does not change product authority.

- [ ] **Step 1: Rewrite audit status around Core Foundation terminology**

Keep historical legacy path references where necessary, but use current terminology in prose:

```text
Core Foundation
Domain Contract
expected downstream failure baseline
```

Do not rename the audit file in this package.

- [ ] **Step 2: Record fresh observed evidence**

The audit must contain actual values for:

```text
exact tested commit SHA
focused Core Foundation command and result/count
pnpm typecheck result
database validator result/count
Google identity verifier result/count
domain-contract observed expected-failure set
full-repository observed expected-failure set
GitHub Actions run ID / URL
artifact name / ID
owner for every accepted downstream failure
```

Remove/supersede any statement that CI evidence was unavailable.

- [ ] **Step 3: Re-run verification after documentation-only changes where needed**

At minimum run:

```bash
pnpm typecheck
pnpm test:core-foundation
```

If documentation is inspected by conformance/static tests, rerun the affected full classified suite too.

- [ ] **Step 4: Commit F5**

```bash
git add docs/audits/2026-09-28-erd3-conformance-red-baseline.md
git commit -m "docs: refreeze core foundation runtime evidence"
```

- [ ] **Step 5: Push the F5 documentation commit and require final CI GREEN**

The final branch HEAD, not merely the pre-audit implementation SHA, must have a successful workflow run. Record that final run in the audit if the SHA changes.

---

## Final Exit Checklist

Do not hand the branch to the next domain-development wave until every item is true:

```text
[PASS] classifier tests prove exact-set equality and fail-closed behavior
[PASS] expected-failure baseline contains only named downstream domain gaps
[PASS] complete Core Foundation focused suite is a hard CI gate
[PASS] PropertyService requires OrganizationService
[PASS] RoomService requires PropertyService
[PASS] direct service tests cannot bypass parent reference integrity
[PASS] supplied empty update strings are rejected
[PASS] pnpm typecheck
[PASS] frozen database validators
[PASS] Google identity regression
[PASS] domain-contract exact baseline classification
[PASS] full-repository exact baseline classification
[PASS] GitHub Actions overall conclusion = success
[PASS] final audit references the actual successful SHA/run/artifact
```

## Stop / Escalation Conditions

Stop instead of weakening the checks when any of these occurs:

```text
Canonical or supporting representations conflict with the approved spec
Node JUnit reporter cannot provide stable testcase identity
full repository failures cannot map one-to-one to the committed downstream baseline
making parent dependencies required reveals a real production circular dependency
DTO hardening requires a new global trimming/normalization policy
fixing the verification layer requires changing downstream domain semantics
```

Escalate with the exact failing command, observed output, affected file, and the smallest decision needed.

## Next Boundary After Completion

This plan ends at a verified Core Foundation freeze. The next implementation wave may begin only after this checklist is green; that later wave owns Listing/Tenancy and related rental-lifecycle work. Naming/folder normalization remains separately deferred.
