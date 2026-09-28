# PostgreSQL/PostGIS implementation progress

This log supplements the concise commit subjects on
`database/postgres-redis-implementation`. It records scope, verification, and
known environment limitations without rewriting already-pushed Git history.

## Prerequisite integration

Commit: `e77edc2 merge: integrate backend core foundations`

- Merged `origin/backend/core-foundations` normally, without rebasing or
  force-pushing.
- Preserved the database implementation plans while incorporating the latest
  backend reconciliation work.
- Merge completed without conflicts.

## Task 1 — Neutral implementation naming

Commit: `253d278 refactor(database): neutralize physical contract tooling names`

- Renamed executable database tooling and tests from level-number names to
  `physical_contract_*` and `schema-smoke.sql`.
- Added TypeScript and Python naming audits for non-documentation paths and
  identifiers.
- Preserved authority-document filenames under `docs/database/`.
- Verification: Python database suite 46/46, TypeScript naming audit, both
  TypeScript project checks, and `git diff --check` passed.

## Task 2 — PostgreSQL runtime configuration

Commit: `cfddd57 feat(database): add postgres runtime configuration`

- Added `pg`, Kysely, `node-pg-migrate`, and PostgreSQL type dependencies.
- Added validated database configuration, environment examples, PostGIS 16
  Compose service, health check, persistent volume, and `trooi_test` bootstrap.
- Added development lifecycle scripts and configuration integration tests.
- Verification: configuration tests 4/4, source/test typechecks, lockfile
  supply-chain policy, and `git diff --check` passed.
- Initial container verification was deferred until Docker Desktop became
  available; the PostGIS service was later confirmed healthy.

## Task 3 — Immutable initial migration

Commit: `eeed35a feat(database): add immutable initial schema migration`

- Added versioned up/down migration SQL and the migration runner.
- Added PostgreSQL test harness and catalog-parity integration test.
- The up snapshot SHA-256 exactly matches the frozen reference DDL and contains
  29 business tables; the down migration contains 29 reverse drops.
- Verification before Docker availability: source/test typechecks, strict
  migration typecheck, snapshot hash/count audits, and `git diff --check`
  passed. Live parity is rerun against PostGIS when the container is available.

## Task 4 — Typed PostgreSQL client

Commit: `aef060d feat(database): add typed postgres client`

- Added Kysely/pg client, Nest database module/token, scalar parsers, and
  persistence schema types for exactly 29 tables and 194 columns.
- Preserved exact decimal strings, calendar dates, normalized timestamps, JSON,
  nullability, and opaque geography values at the persistence boundary.
- Verification: source/test typechecks, Nest build, exact AST contract audit,
  scalar parser smoke test, and `git diff --check` passed. Live scalar
  round-trip is rerun against PostGIS when the container is available.

## Task 5 — Persistence ports and errors

Commit: `b6d11b1 feat(database): define persistence ports and errors`

- Added aggregate-oriented repository ports for all 29 physical records without
  leaking Kysely or `pg` through application boundaries.
- Added lock-aware repository operations and six stable persistence error
  classes.
- Added PostgreSQL SQLSTATE/network error translation without exposing queries
  or row payloads.
- Verification: mapper tests 3/3, source/test typechecks, exact 29-table/194-column
  port audit, dependency-boundary scan, and `git diff --check` passed.

## Cross-cutting constraints retained

- PostgreSQL remains authoritative; Redis work has not started.
- No OPEN policy or FUTURE capability has been decided in implementation.
- No runtime implementation name uses the documentation-only level labels.
- No migration history has been rewritten and no force-push has been used.
