# Database v1 Implementation History

This document is the evidence-based implementation history for database contract `v1`.

It reconstructs the PostgreSQL/PostGIS implementation work from the original database lane and records only claims supported by repository commits and their recorded verification. It does not override `canonical.md`, the ERD, or the SQL contract.

## Baselines

- Prerequisite backend integration: `e77edc2461a216e37f4f05b6715a00daf746ea4d`
- Database implementation baseline: `33975fb4c9300d444c3912fdc9bb7d04d030aab6`
- Converged backend/database integration: `50465bf0ddafc1b7aec2b1e8dfafde35636ca4b9`

## Task 1 ? Neutral implementation naming

**Commit:** `253d278f0c207a089d4069f299a762e3a7abd86c`

- Renamed executable database tooling/tests away from documentation-only LV naming to neutral `physical_contract_*` naming.
- Preserved authority-document filenames at that time.
- Recorded verification in the original progress log: Python database suite, TypeScript naming audit, TypeScript project checks, and `git diff --check` passed.

## Task 2 ? PostgreSQL runtime configuration

**Commit:** `cfddd57bc8d408a858c270bb822a651a777705f7`

- Added PostgreSQL runtime configuration, Kysely / pg / node-pg-migrate dependencies, environment examples, PostGIS Compose service, health check, persistent volume, and test-database bootstrap.
- Original task record states configuration tests, source/test typechecks, lockfile supply-chain policy, and `git diff --check` passed.
- Initial Docker verification was deferred until Docker Desktop became available; PostGIS was confirmed healthy later.

## Task 3 ? Immutable initial schema migration

**Commit:** `eeed35af9aae1b76d5c33d0cc27afb481680e4c2`

- Added versioned up/down migration SQL and migration runner.
- Added PostgreSQL test harness and catalog-parity integration test.
- Original task record states the up snapshot SHA-256 matched the frozen DDL and contained 29 business tables; source/test checks and snapshot audits passed before live Docker parity was available.

## Task 4 ? Typed PostgreSQL client

**Commit:** `aef060d60f29fa359dadc73a592c015f2c32969e`

- Added typed Kysely/pg client, Nest database module/token, scalar parsers, and schema types for the frozen physical model.
- Preserved decimal strings, calendar dates, normalized timestamps, JSON/nullability, and opaque geography values at the persistence boundary.
- Original task record states source/test typechecks, Nest build, exact AST contract audit, scalar parser smoke test, and `git diff --check` passed.

## Task 5 ? Persistence ports and error translation

**Commit:** `b6d11b11c60caeea9096ba363408791e9af62958`

- Added aggregate-oriented repository ports without exposing Kysely/pg through application boundaries.
- Added lock-aware repository operations, persistence error classes, and PostgreSQL SQLSTATE/network error translation.
- Original task record states mapper tests, typechecks, physical-contract port audit, dependency-boundary scan, and `git diff --check` passed.

## Task 6 ? Transaction manager and repository-set factory

**Commit:** `6db963598777d1d2802cfa7c0e9527cc3858d420`

- Added the application-facing `TransactionManager`, nine-repository transaction context, and transaction-scoped repository-set factory.
- After-commit effects run only after successful commit; effect failures do not rewrite committed business results; no implicit retry is performed.
- Recorded verification: PostGIS 16 transaction tests 4/4, source/test typechecks, and `git diff --check` passed.

## Task 7 ? Core rental repositories

**Commit:** `4d0469573afeb9cbe2edca4e96d359e8493bc3a9`

- Implemented Identity, Organization, Property/Room, Listing/StatusEvent/Inquiry PostgreSQL adapters with explicit mappings.
- Added PostGIS point helpers, deterministic room lock ordering, and stable PostgreSQL error translation without inventing OPEN-policy vocabularies.
- Recorded verification: core-rental chain, scalar/null/geography round trips, duplicate-current-listing mapping, FK mapping, catalog parity, typechecks, and `git diff --check` passed on PostGIS 16.

## Task 8 ? Tenancy aggregate repository

**Commit:** `f004e846a1a616b0099b3634aca5a81e5183dbee`

- Implemented Tenancy, Participant, versioned Terms, Acknowledgement, and Notice persistence with stable-owner tenancy locking.
- Preserved exact decimal/date/timestamp/null semantics and left review/deposit-change/acknowledgement OPEN policies undecided.
- Recorded verification: tenancy integration 1/1, source/test typechecks, Nest build, and `git diff --check` passed on PostGIS 16.

## Task 9 ? Finance aggregate repository

**Commit:** `35e95b1c7a54d19f13b42b769a95ffe41b47ed46`

- Implemented BillingCycle, Charge, Utility, MeterReading, Payment, Allocation, Claim, Receipt, Deposit, Application, Settlement, and DepositEvent persistence.
- Used exact decimal strings and SQL aggregate sums with Payment/Deposit owner locks; per-Charge over-allocation policy remained OPEN.
- Recorded verification: finance integration, catalog parity, source/test typechecks, and `git diff --check` passed on PostGIS 16.

## Task 10 ? Supporting repositories

**Commit:** `b7eec592b105e28e597bd9ba24f9796dd29f22df`

- Implemented Incident + append-only IncidentEvent, Review + TrustReport, and Notification adapters.
- Wired all nine aggregate repositories into transaction-scoped repository sets and registered database providers without inventing a notification channel.
- Recorded verification: four repository integration suites, source/test typechecks, Nest build, explicit-column scan, and `git diff --check` passed on PostGIS 16.

## Task 11 ? Rental transaction guards

**Commit:** `51f6eb4887542c1242d2de871c3d0c0a12733c39`

- Added atomic Listing publish, Room transition, Property/Room archive, Tenancy creation/activation, and checkout coordination with deterministic lock ordering.
- Enforced synchronous Listing unpublish when Room becomes unavailable, open-Incident archive blocks, active PRIMARY and nonterminal tenancy rules, and archived-Property reactivation protection.
- Recorded verification: seven rental guards and four mandatory race scenarios passed; race suite passed 10 consecutive runs; typechecks and `git diff --check` passed.

## Task 12 ? Billing and utility guards

**Commit:** `7f395e0c82d6748e36647909ca69c9e59e14ee19`

- Added atomic BillingCycle creation with Tenancy owner locking, overlap prevention, and Terms provenance/effective-boundary checks.
- Added utility Charge validation across Room/type/connection/meter readings while leaving multiple-connections-per-type policy OPEN.
- Recorded verification: behavior + overlap-race tests passed; concurrent overlapping-cycle test passed 20 consecutive runs; typechecks and `git diff --check` passed.

## Task 13 ? Finance transaction guards

**Commit:** `f1849e42b797e1096864bf08d0257cd45808d578`

- Added Payment allocation, Deposit application/settlement, Payment correction, Receipt issue/replacement, and DepositEvent provenance commands with stable owner locks.
- Performed capacity comparisons in PostgreSQL exact numeric queries and preserved predecessor history without synthesizing refund Payments.
- Recorded verification: eight finance guards passed; allocation/application and settlement-cap races passed 20 consecutive runs; typechecks and `git diff --check` passed.

## Task 14 ? Trust consistency guards

**Commit:** `baae892a122036dbd8ce41b62622768ff5a0d413`

- Added Review, PaymentClaim, and TermsAcknowledgement consistency commands with Tenancy locking and Participant/User provenance checks.
- Required ENDED Tenancies for Reviews while keeping occupancy duration, multiplicity, editing/moderation, rating dimension, and property-correction policies OPEN.
- Recorded verification: trust behavior tests, complete guard suite 12/12, physical guard coverage 23/23, typechecks, and `git diff --check` passed.

## Task 15 ? PostGIS public listing search

**Commit:** `33b011d3061d62edc8ab8af5754af0c3c0c80b69`

- Added public Listing search using `ST_DWithin` and `ST_Distance` over `listings.public_location_projection` only.
- Validated finite nonnegative radius, excluded unpublished rows, and avoided exposing operational Property location or inventing unresolved filters.
- Recorded verification: range/privacy/distance/invalid-radius assertions passed, EXPLAIN selected `ix_listings_published_location`, typechecks/static privacy scan/`git diff --check` passed.

## Task 16 ? Deterministic development seed and reset workflow

**Commit:** `b81c933e908ba42f0b16b55ce4224b6b448b5e43`

- Added deterministic synthetic User ? Organization ? Property ? Room seed data through runtime repositories.
- Added `db:reset` and `db:seed` workflows and a second rollback-preparation migration instead of rewriting immutable migration 000001.
- Recorded verification: real down/down/up/seed workflow passed, deterministic reset-and-seed recreation passed twice, migration parity remained 29 business tables, and typechecks/`git diff --check` passed.

## Task 17 ? Wire application services to PostgreSQL and close source-of-truth audit

Task 17 was completed through a sequence of application-wiring and audit commits:

- `5d13dbe421792e8926d6cc50dc0a2e926d07948e` ? aligned runtime Identity contracts to the physical schema; verified 40/40 focused identity/core tests, 9/9 Google verifier tests, 5/5 persistence adapter/transaction tests, and TypeScript typechecks.
- `c2c37ef002d9ac0da6757c2607d39b27e4548c29` ? persisted Identity, Organization, Property, and Room services; verified 36/36 core behavior tests, restart persistence integration, and TypeScript typechecks on PostGIS 16.
- `827ae2be17444e62049fdd4973dd9abd3cb82ee6` ? persisted Listing and Inquiry services; verified 44/44 Listing/Inquiry/rental-lifecycle/conformance tests, restart integration, and TypeScript typechecks.
- `c978d49683dbc13201b28a06d3e7d0ff8e368d1f` ? moved Tenancy, Participant, Terms, Acknowledgement, and Notice state behind PostgreSQL repositories and added restart coverage. The commit message records the implementation but does not enumerate a numeric verification total, so none is invented here.
- `40a16f682b722e52b286a6bf4a2424803b7492f0` ? moved Billing and Receipt state to PostgreSQL repositories and guarded operations; commit message records implementation but does not enumerate a numeric verification total.
- `6f7daa840b8fc30b0350e998adf8608fa6a653ca` ? T17-A/T17-B persisted Incident/IncidentEvent and TrustReport truth and added restart evidence.
- `1dd4c46d0343ccf9346126d6a6cc53c5f2ac112f` ? T17-C proved BillingCycle+Charge atomicity, rollback behavior, finance restart coverage, and retained GREEN guard/concurrency suites.
- `33975fb4c9300d444c3912fdc9bb7d04d030aab6` ? T17-D/T17-E/T17-F removed duplicate onboarding authority, isolated FUTURE Subscription from current-core, added database shutdown lifecycle/explicit Nest injection metadata, cleared lint debt, and recorded lint/typecheck/conformance/runtime/full regression GREEN.

## v1 freeze summary

**Implementation baseline:** `33975fb4c9300d444c3912fdc9bb7d04d030aab6`

Observed state at the freeze:

- PostgreSQL persistence implemented and wired into current application services.
- PostGIS public Search/Map repository implemented.
- Real PostgreSQL transaction/guard/concurrency/restart coverage exists in the database lane.
- Redis implementation was not part of this completed baseline.
- Canonical OPEN policies remain OPEN; canonical FUTURE capabilities remain FUTURE unless separately changed in authority.
- The database branch recorded local/runtime verification as GREEN at the final Task 17 audit. No GitHub Actions run is claimed for the later integration merge SHA `50465bf0ddafc1b7aec2b1e8dfafde35636ca4b9`.

## Known unresolved / non-claims

- `database/migrations/000002_prepare_initial_rollback.ts` exists to preserve immutable 000001 history. Single-step `db:migrate:down` semantics require separate review; this history does not declare them fully reversible.
- The persistence plan contained a planned Task 18 for observability/final verification, but no dedicated Task 18 implementation commit is claimed before the v1 baseline. v1 therefore records completed evidence through Task 17 only.
- Redis and MinIO are not claimed implemented by this release history.
