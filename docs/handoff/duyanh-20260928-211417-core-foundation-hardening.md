# HANDOFF — Core Foundation Hardening

**Recipient:** `duyanh`  
**Created:** `2026-09-28 21:14:17 +07:00`  
**Repository:** `onsra520/TroOi-Project`  
**Branch:** `backend/core-foundations`  
**Handoff baseline HEAD:** `20f4d62ed0c997f0538b904a80eab01e4f139614`  
**Status:** PLAN READY FOR OWNER REVIEW — implementation is not authorized until the owner approves the implementation plan.

## Mission

Harden the already-implemented backend Core Foundation so CI becomes a trustworthy fail-closed gate before the next domain-development wave.

This handoff owns verification infrastructure and narrow foundation hardening only:

```text
F0 deterministic expected-failure classification
F1 independent Core Foundation CI hard gate
F2 mandatory parent dependency wiring
F3 DTO empty-string validation
F4 fresh runtime verification
F5 runtime evidence re-freeze
```

Do not redesign product/domain semantics while executing this package.
## Mandatory reading order

Read these before editing code:

```text
1. docs/handoff/duyanh-20260928-211417-core-foundation-hardening.md
2. docs/superpowers/specs/2026-09-28-core-foundation-hardening-design.md
3. docs/superpowers/plans/2026-09-28-core-foundation-hardening.md
4. docs/audits/2026-09-28-erd3-conformance-red-baseline.md   # legacy filename
5. docs/database/canonical-v3.7.md
6. docs/database/erd/README.md
7. docs/database/erd/trooi-erd-lv1-conceptual.json
8. docs/database/erd/trooi-erd-lv2-logical.json
9. docs/database/erd/trooi-erd-lv3-physical.json
10. docs/database/schema/trooi-schema-lv3.sql
```

Authority order remains:

```text
Canonical v3.7
> ERD LV1
> ERD LV2
> ERD LV3
> validated DDL
> project/module docs
> implementation/tests
```

The ERD files are supporting representations, not the name of this development phase.
## Terminology rules

Use these terms in new implementation/docs:

```text
Core Foundation       Identity / Organization / Property / Room runtime foundation
Domain Contract       executable invariant/conformance boundary
Persistence Layer     future repository/ORM/database adapters
Schema Migration      future database evolution
```

Do not create new task/package names around `ERD3`.

Legacy paths and names that already contain `erd3` remain unchanged in this package, including:

```text
tests/conformance/erd3/
test:conformance:erd3
.github/workflows/backend-erd3-conformance.yml
docs/audits/2026-09-28-erd3-conformance-red-baseline.md
```

Naming/folder normalization is explicitly deferred.

## Current problem state

The current Core Foundation domain implementation is already in place. The remaining defects are verification/hardening issues found during review, not a request to rebuild Organization/Property/Room again.

Most important observed defect: the latest pre-hardening workflow was false-red because its expected-failure assertion grepped human-readable reporter text. The raw domain-contract suite contained the expected downstream failures, but the parser did not recognize the Node 24 reporter format.
Observed reference run before this hardening package:

```text
GitHub Actions run: 36426677867
Head at that run: 9ba41f4d7b8b0ed98ab8c7be83c6f1c3810c2ce5
Typecheck: PASS
Focused Identity: PASS
Database validators: PASS
Raw full domain-contract command: completed with expected downstream RED
Expected-RED assertion step: FAIL because parser pattern was stale
Full repository baseline step: skipped as a consequence
```

Other review findings to fix in this package:

```text
focused Organization/Property/Room behavior is not yet a dedicated CI hard gate
PropertyService parent OrganizationService is optional in direct construction
RoomService parent PropertyService is optional in direct construction
several optional update strings accept empty values
runtime audit does not yet point to a successful final CI run/artifact
```

## Approved design and plan

Design commit:

```text
f3f68ab4401aa762e4d0477406c15c25498e9c32
```

Implementation-plan commit:

```text
20f4d62ed0c997f0538b904a80eab01e4f139614
```

The implementation plan is the task-level execution authority for F0–F5. Do not improvise a different verification architecture without stopping and escalating.
## Execution packets

Execute strictly in this order after owner approval:

```text
F0  Add deterministic exact expected-failure classifier + committed baseline
F1  Make completed Core Foundation tests independent CI hard gates
F2  Remove optional parent dependency bypasses from Property/Room services
F3  Reject supplied empty update strings and add DTO validation to hard gate
F4  Run local + GitHub runtime verification and require workflow GREEN
F5  Update runtime audit with final successful SHA/run/artifact
```

Do not skip RED/GREEN evidence for F0–F3.

### F0 key acceptance

```text
machine-readable reporter only
exact observed failure names == exact committed expected names
new failure -> reject
missing expected failure -> reject
malformed/missing result -> reject
non-empty baseline + fully green suite -> reject as stale baseline
```

The initial expected baseline contains only the currently deferred downstream failures:

```text
Wave B Listing/Tenancy: 14
Wave C Finance: 10
Wave D Incident/Trust: 6
Total: 30
```

Copy exact names from the current runtime audit; do not paraphrase them.
### F1 key acceptance

Core Foundation hard gate must include:

```text
Organization behavior
Property behavior
Room behavior
Identity domain contract
Organization domain contract
Property/Room lifecycle contract
CURRENT/FUTURE runtime boundary
DTO boundary validation after F3
typecheck
database validators
Google identity verifier regression
```

Only raw downstream baseline test commands may use `continue-on-error`; classifier steps may not.

### F2 key acceptance

Required service chain:

```text
OrganizationService
  -> PropertyService
      -> RoomService
```

Direct test construction must use the same parent validation semantics. Do not replace the required dependency with fake `undefined`, `@Optional()`, or a permissive stub.

### F3 key acceptance

These update fields remain optional but reject `''` when supplied:

```text
UpdateOrganizationDto.name
UpdatePropertyDto.name
UpdatePropertyDto.operationalAddressText
UpdateRoomDto.nameOrLabel
```

Whitespace trimming/normalization is not part of this package.
### F4 key acceptance

Run the exact verification sequence from the implementation plan. The final GitHub Actions workflow must conclude `success`.

Do not treat any of these as completion evidence:

```text
source inspection only
local tests without CI
CI with a tolerated failing classifier step
an older successful SHA
an artifact from a different commit
```

Required evidence includes final SHA, run ID/URL, artifact ID/name, and step conclusions.

### F5 key acceptance

Update the legacy-named runtime audit with current Core Foundation terminology and actual fresh CI evidence.

The final branch HEAD after the audit commit must itself receive a green workflow run. If the documentation commit changes the SHA, record that final SHA/run rather than claiming the earlier implementation SHA is the final freeze.

## Hard non-goals

Do not perform any of the following:

```text
rename legacy erd3 folders/scripts/workflow/audit paths
change Canonical v3.7 or supporting ERD semantics
change schema/migrations
introduce ORM/repositories/persistence
implement Listing/Tenancy/Finance/Incident/Trust
implement authorization/resource-relationship hardening
add product features
weaken tests to make CI green
replace exact failure identity with counts or fuzzy matching
```

If implementation requires one of these, STOP and escalate.
## Start procedure after approval

From the `backend/core-foundations` worktree:

```bash
git status
git branch --show-current
git pull --ff-only origin backend/core-foundations
git log --oneline -12
```

Confirm the branch is clean and includes at least plan commit:

```text
20f4d62ed0c997f0538b904a80eab01e4f139614
```

Then read the spec + implementation plan and begin **Task 1 / F0**. Do not start at F2/F3 just because those code changes look smaller.

Recommended execution method after owner approval:

```text
superpowers:subagent-driven-development
```

If the harness has no subagent execution capability, use:

```text
superpowers:executing-plans
```

and preserve the same task-by-task review/verification boundaries.

## Stop conditions

Stop and report rather than guessing if:

```text
JUnit reporter cannot preserve stable testcase identity
full-suite failures do not map exactly to the committed baseline
mandatory parent injection creates a real circular dependency
current authority conflicts with the approved hardening spec
DTO hardening requires a new global normalization policy
CI cannot produce a valid machine-readable result artifact
```

Report the exact command, failing output, affected path, and smallest decision needed.
## Completion report format

When F0–F5 are complete, report using this structure:

```text
Final HEAD:

Commits by packet:
F0:
F1:
F2:
F3:
F5:

Focused Core Foundation:
command:
result/count:

Typecheck:
result:

Database validators:
result/count:

Google identity regression:
result/count:

Domain-contract classification:
observed expected failures:
classifier result:

Full-repository classification:
observed expected failures:
classifier result:

GitHub Actions:
run ID:
run URL:
conclusion:
artifact ID/name:

Remaining accepted failures by owner:
Wave B:
Wave C:
Wave D:

Unexpected failures:
none | exact list
```

Do not state `complete`, `fixed`, or `frozen` without fresh evidence from the final branch HEAD.
