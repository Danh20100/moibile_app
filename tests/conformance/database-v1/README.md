# Database v1 Conformance Suite

Purpose: bridge the frozen Canonical v3.7 / Database v1 model and backend implementation semantics.

## Core rebuild status (H0–H6)

Focused core boundaries are runtime-verified **GREEN**:

- authority / documentation
- identity
- organization
- property / room
- FUTURE runtime boundary (`SubscriptionModule` / `OnboardingModule` absent from `AppModule`)

Remaining product-contract suites are intentionally **RED** until later waves:

- listing
- tenancy
- finance
- incident
- trust

Historical audit reports are available in Git history; current acceptance is determined by tests in this directory.

## Test style

Static source inspection is allowed only while the desired runtime interface is not yet stable. As rebuilt public contracts and services appear, static assertions should be replaced or strengthened with behavioral tests.

Tests assert domain semantics, not one Nest module per ERD table and not a frozen folder layout.

## Authority

`docs/database/v1/canonical.md` → conceptual → logical → physical → validated PostgreSQL/PostGIS reference DDL.

Lower-level docs, code and old tests must change when they conflict with frozen invariants.

## Scope discipline

- CURRENT semantics are pinned by conformance.
- Canonical `[OPEN]` policies remain unresolved; tests must not decide them.
- `[FUTURE]` capabilities must not appear as current core authority merely because old scaffolding exists.

## Baseline rules

- A later rebuild may replace a static assertion with a stronger behavioral, transaction or concurrency test.
- A frozen invariant must **not** be deleted or weakened merely to make the suite green.
- A deliberate invariant change requires changing the higher Canonical/ERD authority first, then updating conformance.
- Source-level evidence does not prove concurrency safety. Guards such as payment caps, one-non-terminal-tenancy-per-Room, Listing/Room coordination and checkout atomicity require later transaction/concurrency verification.
- Authority/documentation tests are expected to be GREEN before and after the core rebuild.
- Product-contract tests outside Identity/Organization/Property/Room remain RED until their owning bounded-context rebuild lands.

## Execution note

Do not label a test runtime-verified until `pnpm test:conformance:database-v1` has actually executed in a checkout with dependencies installed.
