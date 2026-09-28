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

Use a stable test reporter plus an exact expected-failure allowlist, combined with independent hard gates for the completed core foundation.

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

The test command used for classification must force a stable machine-parsable reporter, preferably Node's TAP reporter.

Expected downstream failing test names must live in a committed allowlist owned by the verification layer. The classifier compares the observed failure set with the expected set using exact normalized test names.

The classifier must distinguish:

```text
suite completed with expected failures
suite unexpectedly fully green
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
5. full domain-contract suite through exact baseline classifier
6. full repository suite through exact baseline classifier
```

The completed Core Foundation must have zero accepted failures.

Only explicitly allowlisted downstream domain-contract failures may remain.

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

Identity, Organization, Property, Room, CURRENT/FUTURE runtime boundary, typecheck, database validators, or Google identity failures must never be allowlisted.

When a later wave makes an expected failing test pass, that wave must remove the test from the expected-failure baseline in the same change. A stale expected-failure entry is itself a CI failure.

## 7. Full repository suite classification

The full repository suite must not be treated as "allowed to fail" merely because the domain-contract suite still has known failures.

Its observed failure set must also be classified.

Accepted full-suite failures must map to the same committed downstream expected-failure set. Any failure from another test family is unexpected and fails CI.

This prevents unrelated regression failures from being hidden behind known domain-contract gaps.

## 8. Error handling and fail-closed behavior

The verification pipeline must fail closed.

The following conditions fail CI:

```text
stable reporter cannot run
classifier cannot parse test output
expected-failure baseline file is malformed
observed failure has no exact allowlist entry
allowlist entry is no longer observed
focused core test fails
typecheck fails
database validator fails
Google verifier regression fails
full repository suite has a non-allowlisted failure
```

A command failure without valid test-result structure must be treated as an infrastructure/harness failure, never as an expected product RED.

## 9. Testing strategy

Implementation follows TDD packet-by-packet.

F0 tests must prove the classifier accepts only exact-set equality and rejects:

```text
new unexpected failure
missing expected failure
malformed/unparseable result
fully green suite while expected baseline is non-empty
```

F1 must be verified by the workflow configuration and a real CI run.

F2 must include behavior proving orphan Property and Room creation is rejected even in direct service-based tests with normal construction paths.

F3 must include validator-level tests proving omitted optional values remain valid and supplied empty strings are invalid.

F4/F5 require observed runtime evidence; source inspection is not completion evidence.

## 10. Files expected to change

Exact paths may be refined by the implementation plan, but scope is expected around:

```text
.github/workflows/backend-erd3-conformance.yml
package.json                          # only if a stable reporter/helper script entry is needed
scripts/ or tests/support/            # baseline classifier/helper, if needed
tests/conformance/...                 # expected-failure baseline and classifier coverage
tests/core/...                        # dependency/DTO regression coverage
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
[PASS] stable exact failure-set classification exists
[PASS] complete Core Foundation verification is an independent CI hard gate
[PASS] PropertyService requires OrganizationService
[PASS] RoomService requires PropertyService
[PASS] direct-service tests no longer bypass parent integrity
[PASS] supplied empty update strings are rejected
[PASS] typecheck passes
[PASS] frozen database validators pass
[PASS] Google identity regression passes
[PASS] full domain-contract suite contains only exact allowlisted downstream failures
[PASS] full repository suite contains only the same accepted downstream failures
[PASS] GitHub Actions workflow concludes success
[PASS] fresh runtime evidence is recorded against the final tested SHA/run/artifact
```

Only after this freeze is trustworthy should the next domain-development wave proceed.
