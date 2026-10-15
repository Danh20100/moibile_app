# PostgreSQL + PostGIS Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the authoritative PostgreSQL/PostGIS persistence layer for the frozen TrọƠi physical contract, including immutable migrations, typed query access, repository adapters, all 23 transaction guards, concurrency tests, PostGIS search, seeds, and final application wiring.

**Architecture:** PostgreSQL remains the only authoritative relational business store. Kysely + `pg` implement typed SQL access behind persistence ports; `node-pg-migrate` owns immutable migration history; aggregate-sensitive invariants use explicit transactions and stable-owner row locks under `READ COMMITTED`. Redis is deliberately excluded from this plan except for the `afterCommit` hook that the later cache plan consumes.

**Tech Stack:** NestJS 12, TypeScript 6, Node 22+/24+, PostgreSQL 16, PostGIS 3.4+, `pg`, Kysely, `node-pg-migrate`, Python `unittest` for frozen-contract tooling, Docker Compose for local PostgreSQL.

**Spec:** `docs/superpowers/specs/2026-09-28-postgres-redis-implementation-design.md`

## Global Constraints

- Authority order is Canonical v3.7 → reviewed/frozen ERD documents → validated PostgreSQL/PostGIS reference DDL → migrations/persistence/backend implementation.
- `docs/database/erd/trooi-erd-lv3-physical.json` is the exact physical authority; do not recreate fields, constraints, indexes, or guards from memory.
- PostgreSQL is authoritative business truth; no in-memory Map, cache, or read model may become a second source of truth.
- Do not close any of the 17 OPEN policies in SQL, repository code, DTOs, tests, seeds, or defaults.
- Do not add FUTURE capabilities to the current schema.
- Do not change table ownership, cardinality, FK/CHECK/index semantics, or the 23 frozen transaction guards.
- Do not force-push, merge `main`, delete the worktree, or rewrite shared migration history.
- Documentation may reference LV1/LV2/LV3 authority labels, but non-documentation executable/runtime artifacts must not contain `lv1`, `lv2`, or `lv3` in paths, filenames, identifiers, commands, config keys, cache keys, metrics, or log-event names.
- Existing non-documentation validation tooling that violates that naming rule must be renamed before persistence code is added.
- Keep money exact: PostgreSQL `numeric(18,2)` / `numeric(18,6)` values stay decimal strings at the persistence boundary; authoritative sums/comparisons execute in SQL, never JavaScript floating-point arithmetic.
- Preserve `date` as `YYYY-MM-DD`; normalize `timestamptz` to ISO timestamps at repository boundaries.
- Search/Map must use only the approved public location projection; exact operational location must never leak through public queries.
- Default transaction isolation is `READ COMMITTED`; aggregate-sensitive writes lock stable owner rows before validation and write. Concurrency tests must use independent PostgreSQL connections/transactions, never promise interleaving on one transaction.
- Generic automatic transaction retries are forbidden. A caller may opt into a bounded retry only after proving the whole command idempotent.
- Before executing Task 1, run `git fetch origin` and compare this branch with `origin/backend/core-foundations`. If the shared root is ahead and non-conflicting, integrate it with a normal merge (no rebase/force); if upstream implementation conflicts with this plan or frozen authority, stop and reconcile explicitly.
- Application wiring tasks are gated on backend contract reconciliation. If another lane changes module paths/interfaces before Task 15, stop and update only that task against the merged reconciled contracts rather than improvising.

## Review Focus

1. **Decimal precision:** `numeric` values such as `9999999999999999.99` must round-trip exactly as strings and guard sums must remain exact.
2. **Date/time semantics:** a `date` must never shift because of timezone conversion; `timestamptz` must represent the same instant after round-trip.
3. **Concurrent aggregate writes:** overlapping billing cycles, payment/deposit caps, listing-vacancy races, tenancy activation, checkout, and archive races must serialize safely.
4. **Location privacy:** public spatial search must return/query `public_location_projection`, never `operational_location`.
5. **Failure atomicity:** constraint, guard, deadlock, or application failure inside a multi-write command must leave no partial authoritative writes.

---

## File Structure

Primary new implementation areas:

```text
src/persistence/ports/                 # application-facing persistence contracts only
src/infrastructure/database/           # pg/Kysely implementation, adapters, transactions
database/migrations/                    # immutable migration history
database/seeds/                         # deterministic dev/test seed entry points
tests/integration/persistence/          # real PostgreSQL/PostGIS integration tests
tests/integration/persistence/guards/   # guard behavior + race tests
```

Existing frozen-contract tooling is renamed in place under `scripts/database/` and `tests/database/` before new work starts.

### Task 1: Neutralize implementation naming and add a naming gate

**Files:**
- Rename: `scripts/database/lv3_validate.py` → `scripts/database/physical_contract_validate.py`
- Rename: `scripts/database/lv3_render_sql.py` → `scripts/database/physical_contract_render_sql.py`
- Rename: `scripts/database/lv3_render_lucid.py` → `scripts/database/physical_contract_render_lucid.py`
- Rename: `scripts/database/lv3_verify_catalog.py` → `scripts/database/physical_contract_verify_catalog.py`
- Rename: `scripts/database/lv3_catalog.sql` → `scripts/database/physical_contract_catalog.sql`
- Rename: `tests/database/test_lv3_validate.py` → `tests/database/test_physical_contract_validate.py`
- Rename: `tests/database/test_lv3_render_sql.py` → `tests/database/test_physical_contract_render_sql.py`
- Rename: `tests/database/test_lv3_render_lucid.py` → `tests/database/test_physical_contract_render_lucid.py`
- Rename: `tests/database/test_lv3_verify_catalog.py` → `tests/database/test_physical_contract_verify_catalog.py`
- Rename: `tests/database/sql/trooi-schema-lv3-smoke.sql` → `tests/database/sql/schema-smoke.sql`
- Create: `tests/audit/implementation-naming.static.test.ts`
- Create: `tests/database/test_implementation_naming.py`

**Interfaces:**
- Produces: a neutral-named validation toolchain; static audit `findImplementationNamingViolations(root: string): string[]` inside the test file.
- Preserves: all authority references to the existing `docs/database/...` filenames and all current validation behavior.

- [ ] **Step 1: Write the naming audit first**

Assert that non-doc paths and TypeScript identifiers/package scripts contain no case-insensitive `lv1|lv2|lv3`; the Python audit additionally checks Python `NAME` tokens. Exclude `docs/`, `.git/`, `node_modules/`, `build/`, and `__pycache__/`. Both audits must fail on the current filenames/identifiers before renames.

- [ ] **Step 2: Run the targeted audit and verify RED**

Run: `pnpm exec tsx --test tests/audit/implementation-naming.static.test.ts && python -m unittest discover -s tests/database -p "test_implementation_naming.py" -v`
Expected: FAIL listing the current `scripts/database/...` and `tests/database/...` level-labelled paths.

- [ ] **Step 3: Rename files and neutralize implementation identifiers/output labels**

Update Python imports/test class names such as `LV3ValidatorTests` to semantic names such as `PhysicalContractValidatorTests`; change executable output labels to `Physical contract ...`. Authority-path string literals under `docs/database/` may keep their documented filenames.

- [ ] **Step 4: Run naming + frozen-contract regression tests**

Run: `pnpm exec tsx --test tests/audit/implementation-naming.static.test.ts && python -m unittest discover -s tests/database -p "test_*.py" -v && pnpm typecheck`
Expected: naming audit PASS, database tests 45/45 PASS, typecheck PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/database tests/database tests/audit/implementation-naming.static.test.ts
git commit -m "refactor(database): neutralize physical contract tooling names"
```

### Task 2: Add PostgreSQL tooling, configuration, and local service bootstrap

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `.env.example`
- Create: `compose.persistence.yml`
- Create: `src/infrastructure/database/database.config.ts`
- Create: `database/dev/01-create-test-db.sql`
- Test: `tests/integration/persistence/database-config.integration.ts`

**Interfaces:**
- Add dependencies: `pg`, `kysely`, `node-pg-migrate`; dev dependency: `@types/pg`.
- Add env keys: `DATABASE_URL`, `TEST_DATABASE_URL`; optional `DATABASE_POOL_MAX` default `10`, `DATABASE_CONNECTION_TIMEOUT_MS` default `5000`.
- Produce: `export interface DatabaseConfig { url: string; maxPoolSize: number; connectionTimeoutMs: number }`.
- Produce: `export class DatabaseConfigurationError extends Error` in `database.config.ts`; `loadDatabaseConfig(env: NodeJS.ProcessEnv): DatabaseConfig` throws it for empty/invalid required URL.
- `compose.persistence.yml` starts `postgis/postgis:16-3.4` with a healthcheck and named data volume; the init SQL creates dedicated `trooi_test` alongside `trooi_dev`; no Redis service yet.

- [ ] **Step 1: Write config tests**

Assert valid env maps exactly to the interface; absent/blank `DATABASE_URL` throws; invalid pool/timeout values throw instead of silently coercing.

- [ ] **Step 2: Run config test and verify RED**

Run: `pnpm exec tsx --test tests/integration/persistence/database-config.integration.ts`
Expected: FAIL because `database.config.ts` does not exist.

- [ ] **Step 3: Install dependencies and implement config/bootstrap**

Add package scripts `db:dev:up`, `db:dev:down`, and `db:dev:logs` using `docker compose -f compose.persistence.yml`; do not import this module into `AppModule` yet.

- [ ] **Step 4: Verify config and container health**

Run: `pnpm install && pnpm exec tsx --test tests/integration/persistence/database-config.integration.ts && pnpm db:dev:up && docker compose -f compose.persistence.yml ps`
Expected: test PASS and PostgreSQL service reports healthy.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml .env.example compose.persistence.yml database/dev/01-create-test-db.sql src/infrastructure/database/database.config.ts tests/integration/persistence/database-config.integration.ts
git commit -m "feat(database): add postgres runtime configuration"
```

### Task 3: Create the immutable initial schema migration

**Files:**
- Create: `database/migrations/000001_initial_schema.ts`
- Create: `database/migrations/sql/000001_initial_schema.up.sql`
- Create: `database/migrations/sql/000001_initial_schema.down.sql`
- Create: `scripts/database/migrate.ts`
- Modify: `package.json`
- Test: `tests/integration/persistence/migration-parity.integration.ts`
- Create: `tests/integration/persistence/support/postgres-test-harness.ts`

**Interfaces:**
- `000001_initial_schema.up.sql` is an immutable snapshot of `docs/database/schema/trooi-schema-lv3.sql`; migration runtime must never execute the docs file directly.
- `export async function up(pgm: MigrationBuilder): Promise<void>` executes the snapshot SQL.
- `export async function down(pgm: MigrationBuilder): Promise<void>` executes the explicit reverse-drop SQL for development rollback.
- `runMigrations(direction: 'up' | 'down', databaseUrl: string): Promise<void>` calls the `node-pg-migrate` API.
- Test helper defines `PhysicalCatalog { tables: string[]; primaryKeys: string[]; foreignKeys: string[]; checks: string[]; uniqueConstraints: string[]; indexes: string[] }`, plus `resetPublicSchema(databaseUrl: string): Promise<void>` and `queryCatalog(databaseUrl: string): Promise<PhysicalCatalog>`.

- [ ] **Step 1: Write migration parity test**

Against `TEST_DATABASE_URL`, reset `public`, run `up`, assert PostGIS is installed, assert exactly 29 business tables, then run `physical_contract_catalog.sql` and `physical_contract_verify_catalog.py` against the produced catalog JSON.

- [ ] **Step 2: Run and verify RED**

Run: `pnpm exec tsx --test tests/integration/persistence/migration-parity.integration.ts`
Expected: FAIL because migration runner/history do not exist.

- [ ] **Step 3: Implement migration history and scripts**

Add package scripts `db:migrate`, `db:migrate:down`, `test:persistence:migration`. Keep the migration SQL self-contained and versioned; do not generate schema at runtime from JSON.

- [ ] **Step 4: Verify apply, parity, smoke, down/up**

Run migration parity test, then execute `tests/database/sql/schema-smoke.sql` against the migrated database; run `down`, verify business tables are removed, then run `up` again and re-run parity.
Expected: all checks PASS and final table count is 29.

- [ ] **Step 5: Commit**

```bash
git add database/migrations scripts/database/migrate.ts package.json tests/integration/persistence
git commit -m "feat(database): add immutable initial schema migration"
```

### Task 4: Add typed Kysely/pg client and exact scalar mapping

**Files:**
- Create: `src/infrastructure/database/schema.types.ts`
- Create: `src/infrastructure/database/database.client.ts`
- Create: `src/infrastructure/database/database.tokens.ts`
- Create: `src/infrastructure/database/database.module.ts`
- Create: `src/infrastructure/database/index.ts`
- Test: `tests/integration/persistence/database-client.integration.ts`

**Interfaces:**
- `export type DecimalString = string`, `DateString = string`, `TimestampString = string`.
- `export interface Database` contains exactly the 29 physical table keys from the frozen contract; column names/nullability match the contract exactly.
- Geography columns are opaque in the generic table type and may only be read/written through explicit PostGIS helpers introduced in Task 7.
- `export const DATABASE_CLIENT = Symbol('DATABASE_CLIENT')`.
- `createDatabaseClient(config: DatabaseConfig): Kysely<Database>` creates a `pg.Pool` with `max=config.maxPoolSize`, `connectionTimeoutMillis=config.connectionTimeoutMs`.
- Configure PostgreSQL text parsers so DATE stays `YYYY-MM-DD`, NUMERIC stays an exact string, and TIMESTAMPTZ is normalized to an ISO timestamp string.

- [ ] **Step 1: Write scalar round-trip tests**

Insert/select fixture rows through the client and assert `9999999999999999.99` returns unchanged as a string, `2026-09-28` returns unchanged, and a non-UTC-offset timestamptz returns the same instant normalized to ISO.

- [ ] **Step 2: Run and verify RED**

Run: `pnpm exec tsx --test tests/integration/persistence/database-client.integration.ts`
Expected: FAIL because database client/types do not exist.

- [ ] **Step 3: Implement schema types, parser configuration, client, and Nest provider**

Do not add business enums or defaults to `schema.types.ts`; this file mirrors physical storage shape only. Do not import `DatabaseModule` into `AppModule` yet.

- [ ] **Step 4: Verify tests and typecheck**

Run: `pnpm exec tsx --test tests/integration/persistence/database-client.integration.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/database tests/integration/persistence/database-client.integration.ts
git commit -m "feat(database): add typed postgres client"
```

### Task 5: Define persistence ports and PostgreSQL error translation

**Files:**
- Create: `src/persistence/ports/identity.repository.ts`
- Create: `src/persistence/ports/property.repository.ts`
- Create: `src/persistence/ports/listing.repository.ts`
- Create: `src/persistence/ports/tenancy.repository.ts`
- Create: `src/persistence/ports/finance.repository.ts`
- Create: `src/persistence/ports/incident.repository.ts`
- Create: `src/persistence/ports/trust.repository.ts`
- Create: `src/persistence/ports/notification.repository.ts`
- Create: `src/persistence/ports/organization.repository.ts`
- Create: `src/persistence/ports/geography.ts`
- Create: `src/persistence/ports/repositories.ts`
- Create: `src/persistence/ports/index.ts`
- Create: `src/persistence/errors.ts`
- Create: `src/infrastructure/database/postgres-error.mapper.ts`
- Test: `tests/integration/persistence/postgres-error-mapping.integration.ts`

**Interfaces:**
- Add `organization.repository.ts`; export `OrganizationRepository` separately from identity.
- `geography.ts` exports `GeoPoint { longitude: number; latitude: number }` as the application-facing coordinate value.
- Each repository file defines persistence-facing input/record interfaces containing only exact physical columns for its aggregate tables; geography fields use `GeoPoint`; no derived status, totals, or business defaults.
- `IdentityRepository`: `insertUser(userId: string): Promise<void>`, `userExists(userId: string): Promise<boolean>`.
- `OrganizationRepository`: create/find/update the exact `organizations` row shape and `lockOrganization(organizationId: string): Promise<void>`.
- `PropertyRepository`: exact Property + Room persistence, including `lockProperty(propertyId)`, `lockRoom(roomId)`, and child-state reads needed by archive guards.
- `ListingRepository`: Listing/StatusEvent/Inquiry persistence plus current-listing reads.
- `TenancyRepository`: Tenancy/Participant/Terms/Acknowledgement/Notice persistence plus `lockTenancy(tenancyId)` and active/nonterminal reads.
- `FinanceRepository`: Billing/Charge/Utility/Meter/Payment/Allocation/Claim/Receipt/Deposit/Application/Settlement/Event persistence plus `lockPayment(paymentId)` and `lockDeposit(depositId)`.
- `IncidentRepository`, `TrustRepository`, `NotificationRepository`: exact physical persistence for their owned tables.
- Error classes: `PersistenceUniqueViolation`, `PersistenceForeignKeyViolation`, `PersistenceCheckViolation`, `PersistenceDeadlock`, `PersistenceSerializationFailure`, `PersistenceUnavailable`.
- `mapPostgresError(error: unknown): Error` maps SQLSTATE `23505`, `23503`, `23514`, `40P01`, `40001`, and connection failures without exposing raw SQL/data.

- [ ] **Step 1: Write error-mapping tests and compile-only port assertions**

Construct representative `pg` errors and assert exact mapped classes; add a TypeScript compile fixture that imports every port without importing `pg` or Kysely.

- [ ] **Step 2: Run and verify RED**

Run: `pnpm exec tsx --test tests/integration/persistence/postgres-error-mapping.integration.ts && pnpm typecheck`
Expected: FAIL because ports/errors do not exist.

- [ ] **Step 3: Implement ports and error mapper**

Copy persistence field names/types from the physical contract only. Do not encode OPEN policy decisions in repository method signatures.

- [ ] **Step 4: Verify tests and dependency boundary**

Run targeted test + `pnpm typecheck`; grep `src/persistence/ports` for `kysely|from 'pg'` and expect no matches.

- [ ] **Step 5: Commit**

```bash
git add src/persistence src/infrastructure/database/postgres-error.mapper.ts tests/integration/persistence/postgres-error-mapping.integration.ts
git commit -m "feat(database): define persistence ports and errors"
```

### Task 6: Implement transaction manager and repository-set factory

**Files:**
- Create: `src/infrastructure/database/repositories/repository-set.ts`
- Create: `src/persistence/ports/transaction-manager.ts`
- Create: `src/infrastructure/database/postgres-transaction-manager.ts`
- Test: `tests/integration/persistence/transaction-manager.integration.ts`

**Interfaces:**
- `export interface PersistenceRepositories` exposes `identity`, `organization`, `property`, `listing`, `tenancy`, `finance`, `incident`, `trust`, `notification` ports.
- `export interface TransactionContext { repositories: PersistenceRepositories; afterCommit(effect: () => Promise<void> | void, onError?: (error: unknown) => void): void }`.
- `export interface TransactionManager { run<T>(work: (context: TransactionContext) => Promise<T>): Promise<T> }`.
- `PostgresTransactionManager` opens one Kysely transaction, builds all repositories against that transaction executor, commits once, then runs registered after-commit effects. It performs no implicit retry.
- After-commit effect failure is routed to `onError`/infrastructure logging and never changes an already committed business result.

- [ ] **Step 1: Write transaction tests with a fake repository-set factory**

Assert one successful callback commits all writes; a thrown callback rolls back all writes; `afterCommit` does not run on rollback; after-commit failure cannot undo committed rows; two concurrent manager calls use independent transactions.

- [ ] **Step 2: Run and verify RED**

Run: `pnpm exec tsx --test tests/integration/persistence/transaction-manager.integration.ts`
Expected: FAIL because transaction manager does not exist.

- [ ] **Step 3: Implement transaction manager and repository-set factory contract**

Keep Kysely transaction objects entirely inside infrastructure. Define `TRANSACTION_MANAGER = Symbol('TRANSACTION_MANAGER')` in the port file. Do not register it in `DatabaseModule` until the concrete repository-set factory exists in Task 10.

- [ ] **Step 4: Verify rollback and after-commit behavior**

Run targeted transaction test and `pnpm typecheck`; expected PASS.

- [ ] **Step 5: Commit**

```bash
git add src/persistence/ports/transaction-manager.ts src/infrastructure/database/postgres-transaction-manager.ts src/infrastructure/database/repositories/repository-set.ts tests/integration/persistence/transaction-manager.integration.ts
git commit -m "feat(database): add transactional persistence context"
```

### Task 7: Implement identity, organization, property, room, listing, and inquiry adapters

**Files:**
- Create: `src/infrastructure/database/repositories/identity.repository.ts`
- Create: `src/infrastructure/database/repositories/organization.repository.ts`
- Create: `src/infrastructure/database/repositories/property.repository.ts`
- Create: `src/infrastructure/database/repositories/listing.repository.ts`
- Create: `src/infrastructure/database/postgis.ts`
- Test: `tests/integration/persistence/core-rental-repositories.integration.ts`

**Interfaces:**
- Implement the Task 5 ports exactly; adapters accept a Kysely executor in the constructor so the same class works for pool-level reads and transaction-bound writes.
- `lockProperty` / `lockRoom` use `SELECT ... FOR UPDATE`; property archive child-room locks sort by `room_id` before locking.
- `postgis.ts` provides explicit geography insert/select helpers using `ST_SetSRID(ST_MakePoint(...),4326)::geography` and `ST_X/ST_Y(...::geometry)`; adapters never serialize geography as ad-hoc text.

- [ ] **Step 1: Write repository integration tests**

Create User → Organization → Property → Room → Listing/StatusEvent/Inquiry chains and assert exact persisted values/nullability. Assert a second non-archived Listing for one Room fails with `PersistenceUniqueViolation`; assert FK violations map through the error mapper.

- [ ] **Step 2: Run and verify RED**

Run: `pnpm exec tsx --test tests/integration/persistence/core-rental-repositories.integration.ts`
Expected: FAIL because adapters do not exist.

- [ ] **Step 3: Implement adapters with explicit column lists**

No `SELECT *`; map physical snake_case rows to persistence-facing camelCase models explicitly. Do not add room/property type fields or extra lifecycle defaults.

- [ ] **Step 4: Verify repository tests + catalog parity**

Run targeted test, then migration parity; expected PASS.

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/database/repositories tests/integration/persistence/core-rental-repositories.integration.ts
git commit -m "feat(database): add core rental repositories"
```

### Task 8: Implement Tenancy aggregate adapters

**Files:**
- Create: `src/infrastructure/database/repositories/tenancy.repository.ts`
- Test: `tests/integration/persistence/tenancy-repository.integration.ts`

**Interfaces:**
- Persist `tenancies`, `tenancy_participants`, `tenancy_terms`, `terms_acknowledgements`, `tenancy_notices` exactly.
- Provide `lockTenancy(tenancyId)`, `findNonterminalByRoom(roomId)`, `findActivePrimary(tenancyId)`, `findTermsVersion(tenancyId, version)`, `findTermsById(id)`, participant/user lookups, acknowledgement/notice inserts.
- Never infer Review multiplicity, deposit requirement-change policy, or acknowledgement policy beyond frozen consistency guards.

- [ ] **Step 1: Write tenancy repository tests**

Assert exact FSM vocabulary is accepted by DB checks, duplicate `(tenancy_id, version)` terms fail, duplicate active PRIMARY fails via partial unique index, and date order/nullability are preserved.

- [ ] **Step 2: Run and verify RED**

Run: `pnpm exec tsx --test tests/integration/persistence/tenancy-repository.integration.ts`
Expected: FAIL because adapter does not exist.

- [ ] **Step 3: Implement adapter**

Use exact decimal/date/timestamp mappings from Tasks 4–5; lock methods must lock stable owner rows only, not arbitrary child rows first.

- [ ] **Step 4: Verify**

Run targeted test + `pnpm typecheck`; expected PASS.

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/database/repositories/tenancy.repository.ts tests/integration/persistence/tenancy-repository.integration.ts
git commit -m "feat(database): add tenancy repository"
```

### Task 9: Implement Finance aggregate adapter

**Files:**
- Create: `src/infrastructure/database/repositories/finance.repository.ts`
- Test: `tests/integration/persistence/finance-repository.integration.ts`

**Interfaces:**
- Persist BillingCycle, Charge, UtilityConnection, MeterReading, Payment, PaymentAllocation, PaymentClaim, Receipt, Deposit, DepositPaymentApplication, DepositSettlement, DepositEvent.
- Provide `lockPayment(paymentId)`, `lockDeposit(depositId)`, `findBillingCyclesForTenancy(tenancyId)`, `sumPaymentCommittedAmount(paymentId)`, `sumDepositFundedAmount(depositId)`, `sumDepositSettledAmount(depositId)`.
- Aggregate sums execute in SQL and return `DecimalString`; no JavaScript `number` arithmetic.
- Do not implement a per-Charge aggregate allocation cap while that policy is OPEN.

- [ ] **Step 1: Write finance repository tests**

Assert exact charge whitelist (`RENT|ELECTRICITY|WATER`), payment source/verification vocabularies, receipt/deposit checks, exact decimal round-trip, and SQL aggregate sums with values that exceed safe integer precision.

- [ ] **Step 2: Run and verify RED**

Run: `pnpm exec tsx --test tests/integration/persistence/finance-repository.integration.ts`
Expected: FAIL because adapter does not exist.

- [ ] **Step 3: Implement finance adapter**

Keep all aggregate queries scoped by authoritative foreign keys; return raw exact totals as decimal strings.

- [ ] **Step 4: Verify**

Run targeted test + migration parity + `pnpm typecheck`; expected PASS.

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/database/repositories/finance.repository.ts tests/integration/persistence/finance-repository.integration.ts
git commit -m "feat(database): add finance repository"
```

### Task 10: Implement Incident, Trust, Review, and Notification adapters

**Files:**
- Create: `src/infrastructure/database/repositories/incident.repository.ts`
- Create: `src/infrastructure/database/repositories/trust.repository.ts`
- Create: `src/infrastructure/database/repositories/notification.repository.ts`
- Modify: `src/infrastructure/database/repositories/repository-set.ts`
- Modify: `src/infrastructure/database/database.module.ts`
- Test: `tests/integration/persistence/supporting-repositories.integration.ts`

**Interfaces:**
- Incident adapter persists `incidents` + append-only `incident_events`; expose open-incident reads by Room.
- Trust adapter persists `reviews` + `trust_reports`; expose review/participant/property provenance reads needed by guards.
- Notification adapter persists `notifications` only; it does not select a delivery channel because that policy is OPEN.
- No adapter exposes delete/update methods for append-only event history.

- [ ] **Step 1: Write supporting repository tests**

Assert Incident category/status vocabularies, TrustReport exactly-one-target CHECK, Review response coherence, event append order, and Notification persistence without invented delivery-channel semantics.

- [ ] **Step 2: Run and verify RED**

Run: `pnpm exec tsx --test tests/integration/persistence/supporting-repositories.integration.ts`
Expected: FAIL because adapters do not exist.

- [ ] **Step 3: Implement adapters and wire repository-set factory**

Update `repository-set.ts` so pool and transaction contexts construct all nine aggregate repository ports, then register `DATABASE_CLIENT` and `TRANSACTION_MANAGER` providers in `database.module.ts`.

- [ ] **Step 4: Verify all repository tests**

Run: `pnpm exec tsx --test tests/integration/persistence/*repository*.integration.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/database/repositories src/infrastructure/database/database.module.ts tests/integration/persistence/supporting-repositories.integration.ts
git commit -m "feat(database): add supporting repositories"
```

### Task 11: Implement Room/Property/Listing/Tenancy transaction guards

**Files:**
- Create: `src/persistence/guards/rental-transaction-coordinator.ts`
- Test: `tests/integration/persistence/guards/rental-guards.integration.ts`
- Test: `tests/integration/persistence/guards/rental-concurrency.integration.ts`

**Interfaces:**
- `RentalTransactionCoordinator` is constructed from `TransactionManager` and exposes atomic methods for: `listing_publish_eligibility`, `room_leave_vacant_unpublish`, `property_archive_guard`, `room_archive_guard`, `tenancy_activation`, `tenancy_checkout`, `open_incident_archive_blocker`.
- Lock order for Room-scoped commands: lock Property when required, then Room, then Tenancy; multi-Room property archive locks child Rooms ordered by `room_id`.
- Checkout must update Tenancy `ENDING → ENDED` and Room to `VACANT` in one transaction and synchronously unpublish the current Listing when required.

- [ ] **Step 1: Write failing behavior + race tests**

Cover every listed guard plus races: competing nonterminal Tenancies for one Room, Listing publish vs Room leaving VACANT/occupancy change, checkout vs another Room-state operation, and archive vs a child state becoming ineligible. Each race asserts both caller outcomes and final persisted state.

- [ ] **Step 2: Run and verify RED**

Run: `pnpm exec tsx --test tests/integration/persistence/guards/rental-guards.integration.ts tests/integration/persistence/guards/rental-concurrency.integration.ts`
Expected: FAIL because coordinator does not exist.

- [ ] **Step 3: Implement minimal coordinator with stable-owner locks**

Use only frozen FSM/eligibility semantics. Do not add convenience transitions such as occupied-to-maintenance or archive-from-vacant if authority forbids them.

- [ ] **Step 4: Verify guards, races, and rollback**

Run both targeted files repeatedly (at least 10 runs for race tests) and assert no invalid terminal state appears; run `pnpm typecheck`.

- [ ] **Step 5: Commit**

```bash
git add src/persistence/guards/rental-transaction-coordinator.ts tests/integration/persistence/guards/rental-*.integration.ts
git commit -m "feat(database): enforce rental transaction guards"
```

### Task 12: Implement Billing and Utility transaction guards

**Files:**
- Create: `src/persistence/guards/billing-transaction-coordinator.ts`
- Test: `tests/integration/persistence/guards/billing-guards.integration.ts`
- Test: `tests/integration/persistence/guards/billing-concurrency.integration.ts`

**Interfaces:**
- Enforce exactly: `billing_cycle_no_overlap`, `billing_cycle_terms_provenance`, `utility_provenance`.
- `createBillingCycle(input)` locks the owning Tenancy before checking interval overlap and Terms provenance, then inserts the cycle in the same transaction.
- `createUtilityCharge(input)` validates connection Room, utility type, Charge type, and reading provenance in one transaction; it must not add a max-one utility connection/type rule.

- [ ] **Step 1: Write behavior + mandatory overlap race test**

Create two independent PostgreSQL transactions that concurrently attempt overlapping Billing Cycles for the same Tenancy. Assert exactly one commits and final state has no overlap. Add non-overlap, wrong-Terms-tenancy, invalid effective boundary, and mismatched utility provenance cases.

- [ ] **Step 2: Run and verify RED**

Run: `pnpm exec tsx --test tests/integration/persistence/guards/billing-guards.integration.ts tests/integration/persistence/guards/billing-concurrency.integration.ts`
Expected: FAIL because coordinator does not exist.

- [ ] **Step 3: Implement coordinator**

Use Tenancy as stable lock owner for billing-cycle creation; perform interval comparison in SQL using `period_start`/`period_end` date semantics.

- [ ] **Step 4: Verify repeatedly**

Run race test at least 20 times plus `pnpm typecheck`; expected no dual-commit overlap.

- [ ] **Step 5: Commit**

```bash
git add src/persistence/guards/billing-transaction-coordinator.ts tests/integration/persistence/guards/billing-*.integration.ts
git commit -m "feat(database): enforce billing transaction guards"
```

### Task 13: Implement Payment, Deposit, and Receipt transaction guards

**Files:**
- Create: `src/persistence/guards/finance-transaction-coordinator.ts`
- Test: `tests/integration/persistence/guards/finance-guards.integration.ts`
- Test: `tests/integration/persistence/guards/finance-concurrency.integration.ts`

**Interfaces:**
- Enforce exactly: `payment_allocation_same_tenancy`, `deposit_application_same_tenancy`, `payment_amount_cap`, `payment_correction`, `receipt_issue`, `deposit_event_provenance_amount`, `deposit_settlement_amount_cap`, `receipt_replacement`.
- Payment conservation commands lock Payment first; deposit application then locks Deposit when needed. Deposit settlement locks Deposit before computing funded/settled totals.
- `allocatePayment`, `applyPaymentToDeposit`, `correctPayment`, `issueReceipt`, `settleDeposit`, and `replaceReceipt` each validate and write within one `TransactionManager.run` call.
- Payment/deposit totals are computed and compared in SQL using `numeric`; no negative Payment is ever synthesized for refund.

- [ ] **Step 1: Write behavior + cap race tests**

Cover all eight guards. Run simultaneous allocation/application writes that together would exceed one Payment amount and simultaneous settlements that would exceed funded Deposit amount; assert at most the legal total commits. Also assert multiple Payments may allocate to one Charge because Charge over-allocation policy remains OPEN.

- [ ] **Step 2: Run and verify RED**

Run: `pnpm exec tsx --test tests/integration/persistence/guards/finance-guards.integration.ts tests/integration/persistence/guards/finance-concurrency.integration.ts`
Expected: FAIL because coordinator does not exist.

- [ ] **Step 3: Implement coordinator with Payment/Deposit row locks**

Create DepositEvent rows only with provenance and amount matching the frozen source Application/Settlement. Receipt replacement must preserve predecessor history and require predecessor `VOIDED`.

- [ ] **Step 4: Verify races repeatedly**

Run both files repeatedly (minimum 20 race iterations) and `pnpm typecheck`; final allocated/applied/settled totals must never exceed authoritative caps.

- [ ] **Step 5: Commit**

```bash
git add src/persistence/guards/finance-transaction-coordinator.ts tests/integration/persistence/guards/finance-*.integration.ts
git commit -m "feat(database): enforce finance transaction guards"
```

### Task 14: Implement Review, Claim, and Acknowledgement consistency guards

**Files:**
- Create: `src/persistence/guards/trust-transaction-coordinator.ts`
- Test: `tests/integration/persistence/guards/trust-guards.integration.ts`

**Interfaces:**
- Enforce exactly: `review_eligibility`, `review_historical_property_target`, `payment_claim_consistency`, `terms_acknowledgement_consistency`, `review_author_identity`.
- Review creation validates ENDED Tenancy, Participant/User linkage, author identity, and captures the historical Property target from the reviewed tenancy context.
- Do not enforce minimum occupancy duration, review multiplicity, edit policy, moderation authority, rating dimensions, or property-target correction authority while those policies remain OPEN.

- [ ] **Step 1: Write guard tests**

Assert valid and invalid Review author/Participant/Tenancy combinations, historical Property capture, PaymentClaim participant/payment tenancy mismatch rejection, and TermsAcknowledgement terms/participant/user mismatch rejection. Add a test proving a second otherwise-eligible Review is not rejected solely by an invented multiplicity rule.

- [ ] **Step 2: Run and verify RED**

Run: `pnpm exec tsx --test tests/integration/persistence/guards/trust-guards.integration.ts`
Expected: FAIL because coordinator does not exist.

- [ ] **Step 3: Implement coordinator**

Use the minimum locking needed for consistency; do not broaden moderation/login/rate-limit policy in TrustReport code.

- [ ] **Step 4: Verify all 23 guard IDs have integration coverage**

Add/maintain a static assertion in this test suite that the 23 guard IDs from the physical contract each map to at least one named integration test; run all guard tests and `pnpm typecheck`.
Expected: PASS with 23/23 coverage.

- [ ] **Step 5: Commit**

```bash
git add src/persistence/guards/trust-transaction-coordinator.ts tests/integration/persistence/guards/trust-guards.integration.ts
git commit -m "feat(database): enforce trust consistency guards"
```

### Task 15: Add PostGIS public Search/Map repository

**Files:**
- Create: `src/persistence/ports/listing-search.repository.ts`
- Create: `src/infrastructure/database/repositories/listing-search.repository.ts`
- Test: `tests/integration/persistence/postgis-search.integration.ts`

**Interfaces:**
- Reuse `GeoPoint` from `src/persistence/ports/geography.ts`.
- `PublishedListingSearchResult` contains exactly `listingId`, `roomId`, `publicTitle`, `publicDescription`, `publicPriceProjection: DecimalString`, `publicLocation: GeoPoint`, `distanceMeters: number`.
- `findPublishedWithinRadius(center: GeoPoint, radiusMeters: number): Promise<PublishedListingSearchResult[]>` uses `ST_DWithin`.
- Result distance is computed with `ST_Distance`; insertion/update helpers use `ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography`.
- Query source is only `listings.status = 'PUBLISHED'` and `listings.public_location_projection`; it must never select `properties.operational_location`.
- No room/property type filter is added while vocabulary/ownership policy remains OPEN.

- [ ] **Step 1: Write spatial/privacy tests**

Seed one published listing inside radius, one outside, and one unpublished inside; assert only the published in-range row returns. Give operational and public coordinates deliberately different values and assert returned coordinates/distance use the public projection.

- [ ] **Step 2: Run and verify RED**

Run: `pnpm exec tsx --test tests/integration/persistence/postgis-search.integration.ts`
Expected: FAIL because search repository does not exist.

- [ ] **Step 3: Implement PostGIS repository with explicit SQL helpers**

Validate radius is finite and nonnegative at the repository boundary; do not expose generic geography column reads to public search.

- [ ] **Step 4: Verify GiST-backed plan and behavior**

Run the targeted test and an `EXPLAIN` assertion/inspection showing the published-location GiST index is eligible for the representative `ST_DWithin` query.

- [ ] **Step 5: Commit**

```bash
git add src/persistence/ports/listing-search.repository.ts src/infrastructure/database/repositories/listing-search.repository.ts tests/integration/persistence/postgis-search.integration.ts
git commit -m "feat(database): add postgis listing search"
```

### Task 16: Add deterministic development seed and reset workflow

**Files:**
- Create: `database/seeds/development.ts`
- Create: `database/seeds/seed-data.ts`
- Modify: `package.json`
- Test: `tests/integration/persistence/development-seed.integration.ts`

**Interfaces:**
- `seedDevelopmentData(context: TransactionContext): Promise<void>` uses fixed synthetic UUIDs and the same repositories/coordinators used by runtime code.
- Seed graph contains only CURRENT entities and frozen vocabularies; no real customer data, room/property type vocabulary, subscription, import, or other FUTURE data.
- Package scripts: `db:reset` = down/up migration on the local development DB only; `db:seed` seeds after migration.

- [ ] **Step 1: Write idempotent-seed test**

Reset a test DB, seed once, assert the expected synthetic graph exists and passes guard invariants; reset again and seed again to prove deterministic recreation. Do not require running the seed twice without reset.

- [ ] **Step 2: Run and verify RED**

Run: `pnpm exec tsx --test tests/integration/persistence/development-seed.integration.ts`
Expected: FAIL because seed entry point does not exist.

- [ ] **Step 3: Implement seed using application-safe persistence commands**

Use direct repository inserts only for rows with purely row-local invariants; use transaction coordinators for aggregate-sensitive state such as publish/activation/payment/deposit flows.

- [ ] **Step 4: Verify reset/seed from a fresh container**

Run: `pnpm db:dev:down && pnpm db:dev:up && pnpm db:migrate && pnpm db:seed` followed by the seed integration test.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add database/seeds package.json tests/integration/persistence/development-seed.integration.ts
git commit -m "feat(database): add deterministic development seed"
```

### Task 17: Wire reconciled application services to PostgreSQL persistence

**Execution gate:** Fetch `origin/backend/core-foundations` immediately before this task. If backend reconciliation implementation has not landed, stop here: Tasks 1–16 may exist in parallel, but stale pre-freeze services must not be wired. If it has landed, merge it normally; if module paths/interfaces differ from the paths below, update this task to the merged reconciled contracts rather than building compatibility adapters.

**Expected files if paths remain unchanged:**
- Modify: `src/app.module.ts`
- Modify: `src/modules/identity-access/services/identity-access.service.ts`
- Modify: `src/modules/organization/services/organization.service.ts`
- Modify: `src/modules/property/services/property.service.ts`
- Modify: `src/modules/room/services/room.service.ts`
- Modify: `src/modules/listing/services/listing.service.ts`
- Modify: `src/modules/tenancy/services/tenancy.service.ts`
- Modify: reconciled finance services replacing stale Billing/Receipt payment truth
- Modify: `src/modules/incident/services/incident.service.ts`
- Modify: reconciled trust/review services replacing stale audit-only shapes
- Test: `tests/integration/persistence/application-wiring.integration.ts`
- Test: `tests/audit/persistence-source-of-truth.static.test.ts`

**Interfaces:**
- Import `DatabaseModule` in `AppModule` only after all current-domain services can resolve persistence dependencies.
- Current authoritative services inject repository ports / transaction coordinators; they do not instantiate Kysely/`pg` and do not keep authoritative `Map` state.
- FUTURE subscription/pricing and CSV/import scaffolds must not receive persistence mappings merely to preserve old endpoints.
- Cross-module writes that require atomicity call the transaction coordinators from Tasks 11–14, not independent service writes.

- [ ] **Step 1: Write source-of-truth and restart-persistence tests**

Static test fails if current persisted-domain services declare authoritative `new Map(...)`. Integration test creates representative current-domain state, closes the application/database client, starts a fresh application instance against the same database, and asserts the state remains readable and guard-consistent.

- [ ] **Step 2: Run and verify RED against pre-wiring services**

Run: `pnpm exec tsx --test tests/audit/persistence-source-of-truth.static.test.ts tests/integration/persistence/application-wiring.integration.ts`
Expected: FAIL on in-memory current-domain state / missing providers.

- [ ] **Step 3: Wire one reconciled module slice at a time**

Order: identity/organization → property/room/listing → tenancy → finance → incident/trust/notification. After each slice, run its existing valid regression tests plus new persistence tests before moving on. Do not dual-write to Map + PostgreSQL.

- [ ] **Step 4: Update runtime access tests for database-backed startup**

Ensure the spawned application receives an isolated test `DATABASE_URL`; preserve public/private HTTP access assertions while using PostgreSQL-backed services. Existing tests that assert superseded pre-freeze semantics must be rewritten to frozen authority, not forced green.

- [ ] **Step 5: Verify no current business truth remains in Maps**

Run static source-of-truth audit, application-wiring test, backend regression/conformance tests, and `pnpm typecheck`; expected PASS.

- [ ] **Step 6: Commit**

```bash
git add src tests package.json pnpm-lock.yaml
git commit -m "feat(database): wire application to postgres persistence"
```

### Task 18: Add database observability, health diagnostics, and final verification command

**Files:**
- Create: `src/infrastructure/database/database-telemetry.service.ts`
- Create: `src/infrastructure/database/database-health.service.ts`
- Modify: `src/health.controller.ts`
- Modify: `src/infrastructure/database/postgres-transaction-manager.ts`
- Modify: repository adapters to emit operation-name latency only
- Modify: `package.json`
- Test: `tests/integration/persistence/database-health.integration.ts`

**Interfaces:**
- Health diagnostics expose PostgreSQL reachability and current migration version; they never expose credentials, SQL text, or business payloads.
- Telemetry records pool acquisition/connectivity, query latency by stable operation name, transaction duration/rollback count, and deadlock/serialization counts.
- Package script `test:persistence` runs all `tests/integration/persistence/**/*.integration.ts`; `verify:persistence` runs typecheck, backend regression/conformance, Python frozen-contract tests, migration parity/smoke, integration/guard/race tests, and naming audits.

- [ ] **Step 1: Write health/telemetry tests**

Assert healthy DB reports reachable + migration version, unavailable DB reports a classified database failure, and telemetry operation labels contain no raw IDs/SQL/business payloads.

- [ ] **Step 2: Run and verify RED**

Run: `pnpm exec tsx --test tests/integration/persistence/database-health.integration.ts`
Expected: FAIL because health/telemetry services do not exist.

- [ ] **Step 3: Implement diagnostics and instrumentation**

Use Nest `Logger` or the project’s reconciled logging abstraction. Do not make health checks mutate schema or seed data.

- [ ] **Step 4: Run the complete persistence verification gate**

Run: `pnpm verify:persistence`
Expected minimum evidence: TypeScript PASS; current backend regression/conformance PASS; frozen-contract Python suite PASS; fresh migration apply PASS; schema smoke PASS; catalog parity reports 29 tables; repository/guard/PostGIS/concurrency/seed/wiring tests PASS; naming audits PASS.

- [ ] **Step 5: Verify Git state and migration immutability**

Run: `git diff --check && git status --short && git diff <commit-that-introduced-000001> -- database/migrations/000001_initial_schema.ts database/migrations/sql/000001_initial_schema.up.sql`
Expected: no whitespace errors; only intended uncommitted changes before commit; initial migration has not been rewritten after sharing except during the task that first created it.

- [ ] **Step 6: Commit**

```bash
git add src/infrastructure/database src/health.controller.ts package.json tests/integration/persistence
git commit -m "chore(database): add persistence verification and diagnostics"
```

## Completion Gate

Before claiming this plan complete, confirm all of the following from fresh execution evidence:

- fresh database builds from migration history alone;
- migrated catalog preserves the frozen 29-table physical contract;
- 23/23 transaction guards have real integration coverage;
- mandatory concurrency races cannot commit invalid aggregate state;
- public PostGIS search cannot expose operational location;
- current persisted business truth survives process restart and is not stored in Maps;
- no OPEN policy or FUTURE capability was silently promoted;
- non-documentation implementation naming contains no `lv1`, `lv2`, or `lv3` tokens;
- worktree contains no unintended generated files or secrets.