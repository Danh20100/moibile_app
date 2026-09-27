# ERD3 Conformance Suite

Purpose: bridge the frozen Canonical v3.7 / ERD3 model and backend implementation semantics.

## Initial state

This suite is intentionally **RED** against the pre-ERD3 backend contracts. A failing test is useful only when it identifies a known semantic mismatch.

Import errors, bad paths, syntax errors, missing fixtures or broken test helpers are test-suite defects and are not acceptable RED evidence.

## Test style

Static source inspection is allowed only while the desired runtime interface is not yet stable. As rebuilt public contracts and services appear, static assertions should be replaced or strengthened with behavioral tests.

Tests assert domain semantics, not one Nest module per ERD table and not a frozen folder layout.

## Authority

`docs/database/canonical-v3.7.md` → ERD LV1 → ERD LV2 → ERD LV3 → validated PostgreSQL/PostGIS reference DDL.

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
- Authority/documentation tests are expected to be GREEN before the domain rebuild starts.
- Product-contract tests are expected to be RED until their owning bounded-context rebuild lands.

## Execution note

The baseline audit distinguishes **source-inspected expected RED** from **runtime-verified RED**. Do not label a test runtime-verified until `pnpm test:conformance:erd3` has actually executed in a checkout with dependencies installed.