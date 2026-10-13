# Rental persistence failure handoff — Rental lane owner

Control baseline: clean detached integration `55985da6453773be9a6a456e43f93bf01c8b333d`, migrations **000001–000007 only**, no Profile overlay. PostgreSQL/PostGIS in an owned disposable `trooi_test` database; no shared/production data. No Rental code, tests or fixtures changed.

Install `pnpm install --frozen-lockfile`, set private `TEST_DATABASE_URL` to the isolated database, and run serially:

```powershell
pnpm exec tsx --test --test-concurrency=1 tests/integration/persistence/guards/rental-concurrency.integration.ts tests/integration/persistence/guards/rental-guards.integration.ts
```

Actual result: **5 tests, 3 PASS, 2 FAIL, 0 SKIP**, exit 1. Evidence: `test-results/profile-foundation/stabilization/rental-control.log`, `rental-constraint.log`, and `postgres-diagnostics.log`. This reproduces both Task 2.5 combined-baseline failures without 000008.

| Exact test / definition | Failure | PostgreSQL evidence |
| --- | --- | --- |
| `checkout racing with another room transition preserves tenancy-room coherence` — `tests/integration/persistence/guards/rental-concurrency.integration.ts:6` | Expected tenancy `ENDED`, actual `ENDING`. | Checkout's attempted `ENDED` row violates `ck_tenancies_time_order`: started `2026-10-13 01:44:41.157+00`, ended `2026-10-01 00:00:00+00`. |
| `rental guards enforce publish activation checkout and archive rules` — `tests/integration/persistence/guards/rental-guards.integration.ts:2` | `PersistenceCheckViolation: Persistence check constraint violated` | Same constraint; attempted started `2026-10-13 01:44:43.898+00`, ended `2026-10-01 00:00:00+00`. Persisted tenancy remains `ENDING`, end null. |

Live definition: `CHECK ((ended_at IS NULL) OR (started_at IS NULL) OR (ended_at >= started_at))`. History query confirmed 1–7 and no migration 8.

Evidence-backed cause of the checkout constraint failure: fixture starts with null `startedAt`; activation in `src/persistence/guards/rental-transaction-coordinator.ts:38` fills it with `new Date().toISOString()`, while the tests supply a fixed October 1 checkout date. On October 13, checkout precedes activation. Each fixture resets the database, and the focused run was serial; cross-test ordering is not required to reproduce this failure. The lifecycle setup order itself creates invalid chronology. The concurrency test's `Promise.allSettled` omits rejection assertions, so the checkout failure appears later as a state mismatch. No claim is made that this rules out every other concurrency defect.

Requested owner review: supply validated deterministic JSON lifecycle timestamps and a controlled clock (or an owner-approved setup that persists a start before the fixture end), preserving the SQL invariant. Add a valid activation→checkout regression asserting committed `ENDED`/`VACANT` state and explicit settled outcomes; add an invalid end-before-start case asserting constraint rejection and atomic rollback. Avoid weakening the constraint or introducing sleeps. Confirm both tests on 1–7, then the combined 1–8 baseline and full suite. Production clock changes, if needed, require Rental ownership authorization.

Preserve Canonical v3.7, frozen Database v1 and `vnext.identity-foundation.1` structures/fingerprints, User UUIDs, tenancy/organization ownership and `ck_tenancies_time_order`. Do not skip or mark the failures expected to pass the release gate. No Rental fix or external message was performed. These remain release blockers owned by Rental, independently of the Identity scope gate. This document is the complete outbound message for the Rental owner; owner forwarding is required.
