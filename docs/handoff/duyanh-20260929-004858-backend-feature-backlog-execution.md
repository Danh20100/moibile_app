# HANDOFF — Backend Feature Backlog Execution

**Recipient:** `duyanh`  
**Created:** `2026-09-29 00:48:58 +07:00`  
**Repository:** `onsra520/TroOi-Project`  
**Branch:** `backend/core-foundations`  
**Observed baseline HEAD:** `f5a5324597857b3c360da5500cb95995b366fcdb`  
**Status:** `AUTHORIZED_FOR_CONTINUOUS_BACKLOG_EXECUTION`

## Mission

Continue backend development from `docs/backlogs/` in dependency order.

The feature backlog defines **what must be delivered**. You own the implementation design inside the current trusted product/domain boundaries: inspect the code, choose the technical decomposition, use TDD, implement, verify, commit, push, and continue without waiting for a new per-feature implementation plan.

Owner/reviewer will review commits asynchronously. Do not pause after every clean commit unless a STOP condition is reached.

## Work Queue

`docs/backlogs/README.md` defines the backlog format.

For each selected feature, read its complete brief:

```text
Feature
├── Use Cases
└── Usage Cycle (Mermaid)

Dependencies
Verification
```

Use dependencies to determine execution order. Do not implement a downstream feature before its required upstream boundary is stable.

Wave B Listing/Tenancy/Rental Lifecycle is already frozen by the predecessor handoff and completion audit. Treat those delivered boundaries as regression constraints while moving to later features.

## Trusted Source

Before changing business meaning, reconcile the feature against the current trusted product/domain sources in the repository.

Current authority begins with:

```text
docs/database/canonical-v3.7.md
→ reviewed/frozen ERD LV1
→ ERD LV2
→ ERD LV3
→ validated PostgreSQL/PostGIS reference DDL
→ implementation/tests
```

The version label is not the feature backlog contract. If the repository later contains an explicitly reviewed replacement trusted source, follow the newer approved authority instead of preserving an obsolete version reference.

Lower layers may clarify implementation detail but must not silently weaken or replace higher-level frozen business meaning.

## Execution Authority

For a backlog feature whose required behavior is already clear from trusted sources, you are authorized to:

- inspect and refactor existing backend code;
- design services, coordinators, DTOs, controllers, contracts, and tests;
- add focused technical helpers required by the feature;
- strengthen tests that encode the trusted contract;
- remove stale implementation semantics that conflict with the trusted contract;
- update expected-failure classification when an owned feature legitimately moves RED → GREEN;
- create logical commits and push them to `backend/core-foundations`;
- fix confirmed implementation defects inside the active feature scope.

Do not create a full spec/implementation-plan cycle merely because a feature needs normal implementation design. Escalation is for unresolved product/domain/architecture decisions, not routine engineering decomposition.

## Commit / Review Loop

Keep commits small enough to review by feature or coherent subfeature.

Each implementation commit should have fresh evidence for the behavior it claims. Push completed commits instead of accumulating a large hidden batch.

Normal loop:

```text
select eligible backlog feature
→ inspect trusted source + current implementation
→ write/strengthen failing test
→ implement
→ focused GREEN
→ regression gates
→ commit
→ push
→ continue next coherent unit
```

The owner/reviewer may review any pushed commit while execution continues.

If a review is created, follow `docs/handoff/reviews/README.md` and preserve the distinction between:

```text
CONFIRMED_DEFECT
INTENTIONAL_DEVIATION
CONTEXT_MISSING
PROPOSED_IMPROVEMENT
NEEDS_OWNER_DECISION
```

A confirmed defect inside the currently authorized feature scope may be fixed directly with regression evidence. Product/domain trade-offs and `NEEDS_OWNER_DECISION` remain hard stops for that decision branch.

## Verification Contract

The `Verification` section in each backlog file is the feature-specific exit contract.

Additionally preserve already-frozen predecessor gates. Do not weaken a test or baseline merely to make a new feature green.

At minimum, use the relevant focused tests plus the repository's current hard gates, including typecheck and database/domain validation where applicable. Before freezing a feature/wave, verify the final pushed SHA and CI evidence rather than relying only on source inspection or an earlier local run.

Expected failures must remain exact and owned. When a delivered feature removes an expected RED, reconcile the baseline so stale expected failures cannot remain hidden.

## Scope Discipline

The backlog describes feature intent; it is not permission to invent adjacent product capabilities.

Preserve these rules during execution:

- `[OPEN]` remains unresolved until owner/domain decision.
- `[FUTURE]` is not promoted into the current product for convenience.
- Existing frozen ownership, cardinality, lifecycle, and source-of-truth boundaries remain authoritative.
- Do not introduce duplicate business truth to simplify queries.
- Do not describe in-memory behavior as persistence/concurrency proof.
- Do not silently introduce legal-effect semantics, public personal scoring, booking/hold/reservation semantics, or other capabilities outside the trusted current scope.

## STOP Conditions

STOP the affected decision branch and report evidence when any of these occurs:

- trusted sources contradict each other on behavior required by the feature;
- implementation requires choosing an `[OPEN]` product/domain policy;
- implementation would change a `[FROZEN]` ownership, lifecycle, cardinality, vocabulary, or invariant;
- a requested solution would promote `[FUTURE]` scope;
- a cross-domain change requires a new architecture boundary with material ownership consequences;
- persistence/migration/concurrency strategy requires a decision not already approved by the current database architecture;
- a previously GREEN predecessor boundary regresses for a reason that cannot be explained as the active feature's intentional trusted-source change;
- test/harness/import failures prevent trustworthy verification;
- a review is classified `NEEDS_OWNER_DECISION`.

Do not guess through a STOP condition.

## Required Reading

Before continuing later backend work, read:

```text
docs/backlogs/README.md
relevant docs/backlogs/<feature>.md
current trusted product/domain source
docs/audits/2026-09-28-wave-b-completion.md
docs/handoff/duyanh-20260929-002953-wave-b-listing-tenancy-reconciliation.md
docs/handoff/reviews/README.md
```

Read additional ERD/schema/module material only as required by the selected feature and its dependencies.

## Reporting

For normal progress, a concise commit report is enough:

```text
FEATURE / SUBFEATURE
COMMIT SHA
VERIFICATION RUN
KNOWN DEVIATIONS / OPEN ISSUES
NEXT FEATURE
```

Do not claim completion without fresh evidence.

When a feature or wave is fully frozen, create the normal immutable completion handoff/audit with the final tested SHA, verification evidence, remaining expected RED ownership, intentional deviations, and next dependency boundary.
