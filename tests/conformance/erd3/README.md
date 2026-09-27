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
