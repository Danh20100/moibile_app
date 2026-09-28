# Core Foundation Hardening — Design Specification

**Status:** design approved in chat; implementation not started  
**Scope:** verification hardening for the current backend core foundation  
**Target branch:** `backend/core-foundations`  
**Primary authority:** Canonical v3.7, with ERD LV1/LV2/LV3 and validated DDL as supporting representations

## 1. Intent

Harden the current backend foundation so runtime verification is trustworthy before the next domain-development wave begins.

This work does not redesign the product and does not advance Listing, Tenancy, Finance, Incident, Trust, persistence, migrations, or authorization semantics. It focuses on making the current Identity / Organization / Property / Room foundation verifiable, fail-safe, and resistant to false-green or false-red CI behavior.

The desired end state is:

```text
known core contracts regress -> CI fails
known accepted downstream gaps remain -> CI passes with explicit baseline classification
new unexpected failure appears -> CI fails
an expected failure disappears -> CI fails until the baseline is intentionally reconciled
```

## 2. Terminology

Do not use `ERD3` as the name of a development phase, implementation package, workflow state, or handoff package from this point forward.

Use these terms instead:

```text
Canonical v3.7        product/domain authority
ERD LV1/LV2/LV3       supporting domain/database representations
Core Foundation       Identity / Organization / Property / Room runtime foundation
Domain Contract       executable invariant/conformance boundary
Persistence Layer     repository/ORM/database adapters
Schema Migration      future database evolution only
```

Existing paths such as `tests/conformance/erd3/` and script names such as `test:conformance:erd3` are legacy compatibility names. Renaming file/folder/script structure is explicitly deferred to a later normalization task.

## 3. Current observed problems

### 3.1 CI false-red

The current workflow allows the full domain-contract suite to fail, then attempts to prove that the failure is intentional by grepping human-readable test output.

The matcher assumes older TAP-style output such as:

```text
not ok
# fail N
```

The current Node test reporter emits different text. As a result, the suite can have exactly the expected downstream failures while the workflow itself still fails.

This is a verification-system defect, not a product-domain failure.

### 3.2 Focused core tests are not a dedicated CI hard gate

Organization, Property, and Room behavior tests exist, but the current workflow does not run the complete focused core set as an independent mandatory step before the tolerated downstream RED baseline.

A future core regression could therefore be mixed into a suite that is already expected to contain failures.

### 3.3 Optional dependency injection weakens referential integrity in direct service usage

`PropertyService` currently permits `OrganizationService` to be absent, and `RoomService` permits `PropertyService` to be absent.

The production Nest module graph wires these dependencies, but direct construction can bypass parent-reference validation. Unit tests currently rely on this bypass in several places.

The core services should require their parent dependency. Tests should build a real in-memory dependency chain instead of disabling referential checks.

### 3.4 Update DTOs accept empty string values

Several optional string fields are type-valid but permit empty strings when present.

Current examples include:

```text
UpdateOrganizationDto.name
UpdatePropertyDto.name
UpdatePropertyDto.operationalAddressText
UpdateRoomDto.nameOrLabel
```

These should remain optional, but when supplied they must be non-empty.

### 3.5 Freeze evidence is stale relative to actual CI

The current audit records local runtime evidence and an earlier freeze point, while fresh CI now exists. The final core-foundation freeze should reference the actual tested commit, GitHub Actions run, artifact, hard-gate results, and expected downstream failure set.

## 4. Chosen approach

Use a stable test reporter plus an exact expected-failure baseline, combined with independent hard gates for the completed core foundation.

This is intentionally narrower than building a custom verification platform.

The verification model has two classes of tests:

### Hard gates

These must be fully GREEN:

```text
Identity domain contract
Organization domain contract + behavior
Property domain contract + behavior
Room domain contract + behavior
CURRENT/FUTURE runtime boundary
TypeScript typecheck
frozen database validators
Google identity regression
```

Any failure in a hard gate fails CI immediately.

### Baseline-classified suites

The full domain-contract suite and full repository suite may still contain failures from not-yet-rebuilt downstream domains.

Those failures are accepted only when the observed failing test names exactly match the committed expected-failure baseline.

The classifier must reject all three drift cases:

```text
unexpected new failure      -> fail
expected failure disappears -> fail until baseline is updated intentionally
command/harness failure      -> fail
```

## 5. Architecture

The work is split into F0–F5.

### F0 — Stable domain-contract failure classification

Replace reporter-dependent grep heuristics with deterministic classification.

The classified test commands must force Node's TAP reporter so the verifier consumes a stable protocol rather than the default human reporter.

Use one small reusable verifier script:

```text
scripts/verify-expected-test-failures.mjs
```

It accepts a TAP result file plus the process exit code and compares the observed failing test names with one committed baseline file:

```text
tests/conformance/expected-domain-contract-failures.json
```

The baseline JSON is an array of objects with this exact semantic shape:

```json
[
  {
    "test": "exact test name",
    "owner": "Listing / Tenancy",
    "reason": "not rebuilt in the current Core Foundation package"
  }
]
```

`test` is the exact normalized test title used for set comparison. `owner` and `reason` are mandatory metadata for handoff and audit traceability.

The verifier must compare sets, not counts. It must report the three useful diffs separately:

```text
unexpected failures
missing expected failures
matched expected failures
```

It must also validate that TAP completion metadata is present and internally consistent. A nonzero process exit code is accepted only when valid TAP proves that the exact expected set failed.

The classifier must distinguish:

```text
suite completed with expected failures
suite unexpectedly fully green while baseline is non-empty
suite failed with a new test failure
suite failed because of syntax/import/harness/command error
```

A generic grep for words like `not ok`, `ERD3`, or any nonzero fail count is not sufficient.

The legacy test directory and package-script names may remain unchanged in this task.

### F1 — Core Foundation CI hard gate

Add one explicit CI step that runs the complete focused core verification set before any baseline-tolerated suite.

The hard gate includes:

```text
tests/core/organization.behavior.test.ts
tests/core/property.behavior.test.ts
tests/core/room.behavior.test.ts
tests/conformance/erd3/identity.contract.test.ts
tests/conformance/erd3/organization.contract.test.ts
tests/conformance/erd3/property-room.lifecycle.test.ts
tests/conformance/erd3/future-open-boundary.static.test.ts
```

The existing TypeScript typecheck and database validators remain hard gates.

Google identity verifier regression must also be run as a hard gate before the baseline-classified full suites.

No `continue-on-error` is allowed for these completed boundaries.

For the two baseline-classified suites, the workflow may capture a nonzero test-process exit code without aborting the shell, but only long enough to pass the TAP file and captured exit code to the verifier. The verifier's result determines the CI step result.

### F2 — Required parent dependency wiring

Make the parent dependency mandatory in the in-memory core service layer:

```text
PropertyService requires OrganizationService
RoomService requires PropertyService
```

Remove optional-injection behavior that allows referential integrity checks to disappear.

Tests that construct these services directly must create the real in-memory chain:

```text
OrganizationService
  -> PropertyService
      -> RoomService
```

Test helpers may encapsulate this setup, but they must not fake away parent existence checks.

This task does not introduce persistence ports, repositories, ORM abstractions, or dependency-injection redesign. Those belong to the future Persistence Layer work.

### F3 — DTO boundary hardening

Keep update fields optional but reject empty strings when supplied.

At minimum harden:

```text
UpdateOrganizationDto.name
UpdatePropertyDto.name
UpdatePropertyDto.operationalAddressText
UpdateRoomDto.nameOrLabel
```

Create DTO fields already requiring non-empty values must keep that behavior.

Validation coverage must exercise actual class-validator behavior rather than only source-text assertions.

Whitespace-only normalization is out of scope unless the existing application already defines a trimming policy. This task only requires non-empty values under the current validation model.

### F4 — Fresh runtime verification

After F0–F3 are implemented, run a fresh verification sequence on the resulting commit.

Required order:

```text
1. focused Core Foundation hard gate
2. pnpm typecheck
3. frozen database validators
4. Google identity verifier regression
5. full domain-contract suite with TAP + exact baseline verifier
6. full repository suite with TAP + exact baseline verifier
```

The completed Core Foundation must have zero accepted failures.

Only explicitly baselined downstream domain-contract failures may remain.

### F5 — Re-freeze evidence

Update the runtime audit with fresh evidence from the verified commit.

The audit must record:

```text
exact commit SHA tested
exact verification commands
focused hard-gate counts/results
typecheck result
database validator count/result
Google identity regression count/result
full domain-contract observed failure set
full repository observed failure set
GitHub Actions run ID / URL reference
uploaded artifact name or ID
remaining downstream owner/wave for every accepted failure
```

Remove or supersede statements that CI evidence was unavailable.

The final workflow must itself be GREEN when all hard gates pass and the observed downstream failure set exactly matches the committed baseline.

## 6. Expected-failure baseline rules

The baseline is a temporary migration aid, not a blanket waiver.

Every allowed failure must have:

```text
exact test name
owning future wave/domain
reason it is not fixed in this package
```

Current accepted owners remain limited to not-yet-rebuilt domains such as:

```text
Listing / Tenancy
Finance
Incident / Trust
```

Identity, Organization, Property, Room, CURRENT/FUTURE runtime boundary, typecheck, database validators, or Google identity failures must never be baselined.

When a later wave makes an expected failing test pass, that wave must remove the test from the expected-failure baseline in the same change. A stale expected-failure entry is itself a CI failure.

## 7. Full repository suite classification

The full repository suite must not be treated as "allowed to fail" merely because the domain-contract suite still has known failures.

Its observed failure set must also be classified by the same verifier and the same expected-failure baseline.

Accepted full-suite failures must therefore be the same named downstream domain-contract failures. Any failure from another test family is unexpected and fails CI.

This prevents unrelated regression failures from being hidden behind known domain-contract gaps.

If the full suite wraps or prefixes a test title differently from the focused domain-contract invocation, normalization must be deterministic and covered by verifier tests; fuzzy/substring matching is forbidden.

## 8. Error handling and fail-closed behavior

The verification pipeline must fail closed.

The following conditions fail CI:

```text
stable reporter cannot run
classifier cannot parse test output
TAP completion metadata is missing or inconsistent
expected-failure baseline file is malformed
observed failure has no exact baseline entry
baseline entry is no longer observed
focused core test fails
typecheck fails
database validator fails
Google verifier regression fails
full repository suite has a non-baselined failure
```

A command failure without valid test-result structure must be treated as an infrastructure/harness failure, never as an expected product RED.

## 9. Testing strategy

Implementation follows TDD packet-by-packet.

F0 verifier tests must use TAP fixtures representing actual Node 24 output and prove exact-set behavior for:

```text
exact expected set -> pass
new unexpected failure -> fail
missing expected failure -> fail
malformed/unparseable result -> fail
inconsistent TAP totals -> fail
fully green suite while expected baseline is non-empty -> fail
```

F1 must be verified by workflow configuration plus a real GitHub Actions run.

F2 must include behavior proving orphan Property and Room creation is rejected through normal direct-service construction with required parent dependencies.

F3 must include validator-level tests proving omitted optional values remain valid and supplied empty strings are invalid.

F4/F5 require observed runtime evidence; source inspection is not completion evidence.

## 10. Files expected to change

The implementation plan may refine exact test/helper placement, but scope is expected around:

```text
.github/workflows/backend-erd3-conformance.yml
package.json                                      # only if a helper script entry is useful
scripts/verify-expected-test-failures.mjs
tests/conformance/expected-domain-contract-failures.json
tests/support/ or tests/core/                     # verifier fixtures/tests and domain regressions
src/modules/organization/dto/index.ts
src/modules/property/dto/index.ts
src/modules/property/services/property.service.ts
src/modules/room/dto/index.ts
src/modules/room/services/room.service.ts
docs/audits/2026-09-28-erd3-conformance-red-baseline.md
```

The old filenames containing `erd3` are legacy paths and are not renamed in this package.

## 11. Explicit non-goals

Do not do any of the following in this package:

```text
rename conformance folders/scripts/workflows for naming cleanup
change Canonical v3.7 or frozen ERD semantics
change database schema or migrations
introduce ORM/repository persistence
implement Listing/Tenancy/Finance/Incident/Trust semantics
implement resource-relationship authorization hardening
add new product features
change current domain lifecycle rules
turn expected downstream RED into broad ignored failures
```

## 12. Completion criteria

Core Foundation Hardening is complete only when all conditions are simultaneously true:

```text
[PASS] stable TAP + exact failure-set verification exists
[PASS] expected-failure baseline carries exact test/owner/reason metadata
[PASS] complete Core Foundation verification is an independent CI hard gate
[PASS] PropertyService requires OrganizationService
[PASS] RoomService requires PropertyService
[PASS] direct-service tests no longer bypass parent integrity
[PASS] supplied empty update strings are rejected
[PASS] typecheck passes
[PASS] frozen database validators pass
[PASS] Google identity regression passes
[PASS] full domain-contract suite contains only exact baselined downstream failures
[PASS] full repository suite contains only the same accepted downstream failures
[PASS] GitHub Actions workflow concludes success
[PASS] fresh runtime evidence is recorded against the final tested SHA/run/artifact
```

Only after this freeze is trustworthy should the next domain-development wave proceed.
