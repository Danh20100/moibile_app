# Redis Cache Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Redis as optional, reconstructable cache infrastructure for safe read projections without making Redis part of TrọƠi business correctness.

**Architecture:** PostgreSQL remains authoritative. The official Node `redis` client sits behind a `CachePort`; cache-aside reads fall back to PostgreSQL on miss/error, writes commit PostgreSQL first, and invalidation runs through the PostgreSQL transaction manager’s `afterCommit` hook. The first production cache surface is a bounded-staleness organization operations summary; Listing/Search is explicitly not cached.

**Tech Stack:** NestJS 12, TypeScript 6, official `redis` Node client, PostgreSQL/Kysely persistence from the preceding plan, Docker Compose Redis.

**Spec:** `docs/superpowers/specs/2026-09-28-postgres-redis-implementation-design.md`

**Prerequisite:** `docs/superpowers/plans/2026-09-28-postgresql-postgis-persistence.md` is complete and its final verification gate is green.

## Global Constraints

- Redis is never authoritative business truth; a complete Redis flush must not lose business state.
- No transaction guard, authorization decision, lifecycle decision, payment/deposit conservation check, or OPEN policy may depend on Redis.
- PostgreSQL writes commit before cache invalidation/mutation runs.
- Redis GET failure falls back to PostgreSQL; Redis SET/DEL failure never rolls back or converts a committed PostgreSQL business write into a failure.
- Every business cache namespace has an explicit TTL, source PostgreSQL projection, invalidation trigger, acceptable staleness, and fallback.
- Runtime invalidation must not use Redis `KEYS` scans.
- Do not cache public Listing/Search in this phase.
- Do not add room/property type vocabulary, notification-channel policy, or any other OPEN-policy answer through cache keys or projections.
- Non-documentation implementation names must not contain `lv1`, `lv2`, or `lv3`.
- Do not force-push, merge `main`, rewrite shared migrations, or delete the worktree.## Review Focus

1. **Redis outage on reads:** cache GET error must return PostgreSQL data, not 5xx solely because Redis is down.
2. **Redis outage after writes:** committed PostgreSQL writes must remain successful even when invalidation fails.
3. **Corrupt cache payload:** invalid JSON/wrong-version payload is treated as a miss and reconstructed from PostgreSQL.
4. **Environment/key isolation:** development/test/production keys can never collide; invalidation addresses exact keys only.
5. **Flush/restart recovery:** deleting all Redis keys and restarting the app must reconstruct the same read result from PostgreSQL.

---

## File Structure

```text
src/persistence/ports/cache.port.ts
src/infrastructure/cache/redis.config.ts
src/infrastructure/cache/redis.client.ts
src/infrastructure/cache/redis-cache.adapter.ts
src/infrastructure/cache/cache-key.factory.ts
src/infrastructure/cache/cache-aside.service.ts
src/infrastructure/cache/cache-telemetry.service.ts
src/infrastructure/cache/cache.module.ts
src/read-models/organization-operations-summary.repository.ts
src/read-models/organization-operations-summary.service.ts
tests/integration/cache/
```

### Task 1: Add Redis configuration, client lifecycle, and degraded startup

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `.env.example`
- Modify: `compose.persistence.yml`
- Create: `src/infrastructure/cache/redis.config.ts`
- Create: `src/infrastructure/cache/redis.client.ts`
- Create: `src/infrastructure/cache/cache.module.ts`
- Test: `tests/integration/cache/redis-client.integration.ts`

**Interfaces:**
- Add dependency: `redis`.
- Env: `REDIS_URL` optional; blank/missing means cache disabled, not business startup failure.
- Env: `CACHE_ENVIRONMENT` required when Redis is enabled; allowed pattern `[a-z0-9-]+`; tests use `test`.
- Env: `REDIS_CONNECT_TIMEOUT_MS` default `1000`.
- `loadRedisConfig(env): RedisConfig` returns `{ enabled: false }` or `{ enabled: true, url, environment, connectTimeoutMs }`.- `export const REDIS_CLIENT = Symbol('REDIS_CLIENT')`; provider value is `RedisClientType | null`.
- `compose.persistence.yml` adds `redis:7.4-alpine` with healthcheck and command `redis-server --save "" --appendonly no`, intentionally proving cache reconstructability without Redis persistence.

- [ ] **Step 1: Write Redis config/client tests**

Assert disabled config when URL is absent, rejection of enabled config without a valid environment, successful `PING` when Redis is running, and application-level construction still succeeds when Redis is unreachable.

- [ ] **Step 2: Run and verify RED**

Run: `pnpm exec tsx --test tests/integration/cache/redis-client.integration.ts`
Expected: FAIL because Redis infrastructure does not exist.

- [ ] **Step 3: Install client and implement optional lifecycle**

Connection failures must be logged/classified as cache degradation. Do not throw from application bootstrap solely because Redis cannot connect.

- [ ] **Step 4: Verify running and degraded modes**

Run with Redis healthy, then stop only Redis and rerun degraded-start assertion; PostgreSQL remains running throughout.
Expected: both test paths PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml .env.example compose.persistence.yml src/infrastructure/cache tests/integration/cache/redis-client.integration.ts
git commit -m "feat(cache): add optional redis client"
```

### Task 2: Implement cache contract, key policy, cache-aside fallback, and telemetry

**Files:**
- Create: `src/persistence/ports/cache.port.ts`
- Create: `src/infrastructure/cache/cache-policy.ts`
- Create: `src/infrastructure/cache/cache-key.factory.ts`
- Create: `src/infrastructure/cache/redis-cache.adapter.ts`
- Create: `src/infrastructure/cache/cache-aside.service.ts`
- Create: `src/infrastructure/cache/cache-telemetry.service.ts`
- Modify: `src/infrastructure/cache/cache.module.ts`
- Test: `tests/integration/cache/cache-aside.integration.ts`
- Test: `tests/audit/cache-policy.static.test.ts`

**Interfaces:**
- `CachePort`: `getJson<T>(key: string): Promise<T | null>`, `setJson<T>(key: string, value: T, ttlSeconds: number): Promise<void>`, `delete(key: string): Promise<void>`. When Redis is disabled, the adapter behaves as a permanent miss with no-op SET/DEL rather than throwing.
- `CacheKeyFactory.create(namespace: string, resourceKey: string): string` returns `trooi:<environment>:v1:<namespace>:<resourceKey>`.
- `CacheAsideService.getOrLoad<T>(key, ttlSeconds, loader): Promise<T>` treats miss/error/corrupt envelope as PostgreSQL-loader path; SET failure returns loaded data successfully.
- Cache JSON uses envelope `{ version: 1, value: T }`; any other version is a miss.
- Telemetry counters are grouped by namespace only: hit, miss, get_error, set_error, delete_error, fallback.- `CACHE_POLICIES.organizationOperationsSummary = { namespace: 'dashboard:organization', ttlSeconds: 60, acceptableStalenessSeconds: 60 }` is the only business cache policy in this plan.

- [ ] **Step 1: Write policy + fallback tests**

Assert exact key format and environment separation; all policies have positive finite TTL; no namespace contains `listing` or `search`; GET miss calls loader once and SETs TTL; Redis GET/SET errors still return loader data; malformed/wrong-version JSON is a miss.

- [ ] **Step 2: Run and verify RED**

Run: `pnpm exec tsx --test tests/integration/cache/cache-aside.integration.ts tests/audit/cache-policy.static.test.ts`
Expected: FAIL because cache contract/policy/adapter do not exist.

- [ ] **Step 3: Implement cache port, adapter, key factory, policy registry, telemetry, and cache-aside service**

Never log full cache keys/resource IDs in telemetry; log namespace + operation/error class only. Adapter must use `SET ... EX <ttlSeconds>` and direct `DEL <key>` only.

- [ ] **Step 4: Verify healthy, disabled, corrupt-payload, and Redis-down paths**

Run both targeted tests with Redis healthy and with the Redis container stopped for the error-path subtest; expected PASS.

- [ ] **Step 5: Commit**

```bash
git add src/persistence/ports/cache.port.ts src/infrastructure/cache tests/integration/cache/cache-aside.integration.ts tests/audit/cache-policy.static.test.ts
git commit -m "feat(cache): add cache-aside infrastructure"
```

### Task 3: Add PostgreSQL-backed organization operations summary as the first safe cache surface

**Files:**
- Create: `src/read-models/organization-operations-summary.ts`
- Create: `src/persistence/ports/organization-operations-summary.repository.ts`
- Create: `src/infrastructure/database/repositories/organization-operations-summary.repository.ts`
- Create: `src/read-models/organization-operations-summary.service.ts`
- Create: `src/read-models/read-models.module.ts`
- Test: `tests/integration/cache/organization-summary.integration.ts`

**Interfaces:**
- `OrganizationOperationsSummary` contains exactly: `organizationId`, `activePropertyCount`, `activeRoomCount`, `vacantRoomCount`, `occupiedRoomCount`, `openIncidentCount`.
- PostgreSQL repository method: `findByOrganizationId(organizationId: string): Promise<OrganizationOperationsSummary>`.
- `activePropertyCount`: `properties.lifecycle_status = 'ACTIVE'` for the Organization.
- `activeRoomCount`: Rooms under the Organization with `record_lifecycle = 'ACTIVE'`.
- `vacantRoomCount` / `occupiedRoomCount`: active Rooms with matching operational state.
- `openIncidentCount`: Incidents under the Organization whose status is not `CLOSED` or `REJECTED`.
- Service method: `get(organizationId: string): Promise<OrganizationOperationsSummary>` passes namespace `dashboard:organization` and resource key `<organizationId>` to `CacheKeyFactory`, producing full key `trooi:<environment>:v1:dashboard:organization:<organizationId>` with TTL 60 seconds.
- `ReadModelsModule` imports `DatabaseModule` and `CacheModule`, provides the PostgreSQL summary repository + summary service, and exports `OrganizationOperationsSummaryService`; it creates no new HTTP endpoint.

- [ ] **Step 1: Write PostgreSQL projection + cache hit/miss tests**

Seed one Organization with active/archived Properties, active Rooms in VACANT/OCCUPIED/MAINTENANCE states, and open/closed Incidents. Assert the PostgreSQL summary counts exactly. Wrap the repository with a counting test double and assert two service reads cause one PostgreSQL load when Redis is healthy.

- [ ] **Step 2: Run and verify RED**

Run: `pnpm exec tsx --test tests/integration/cache/organization-summary.integration.ts`
Expected: FAIL because summary repository/service do not exist.

- [ ] **Step 3: Implement projection query and cache-backed service**

Use one SQL query or a bounded set of explicit aggregate queries; do not read Redis for authorization, transaction guards, or state transitions. Convert SQL count outputs only after asserting they are safe nonnegative integers.

- [ ] **Step 4: Verify TTL and PostgreSQL fallback**

Assert Redis key TTL is `<= 60` and `> 0`; flush the key and assert the next call reconstructs the same counts from PostgreSQL.

- [ ] **Step 5: Commit**

```bash
git add src/read-models src/persistence/ports/organization-operations-summary.repository.ts src/infrastructure/database/repositories/organization-operations-summary.repository.ts tests/integration/cache/organization-summary.integration.ts
git commit -m "feat(cache): cache organization operations summary"
```

### Task 4: Invalidate organization summary only after authoritative commits

**Files:**
- Create: `src/read-models/organization-summary-cache-invalidator.ts`
- Modify: `src/persistence/guards/rental-transaction-coordinator.ts`
- Modify: reconciled Property/Room application write services from the PostgreSQL plan
- Modify: reconciled Incident application write service
- Test: `tests/integration/cache/organization-summary-invalidation.integration.ts`

**Interfaces:**
- `OrganizationSummaryCacheInvalidator.invalidate(organizationId: string): Promise<void>` deletes exactly one `dashboard:organization` key.
- Property create/archive, Room create/operational-state/lifecycle change, Incident create/status change register invalidation through `TransactionContext.afterCommit`. If invalidation fails, bounded staleness may persist for at most the declared 60-second TTL.
- Resolve `organizationId` from authoritative PostgreSQL relationships before commit; capture the ID for the after-commit callback.
- Listing, Tenancy, Finance, Review, and Notification writes do not invalidate this summary because none of its defined fields depend on them.

- [ ] **Step 1: Write success + Redis-failure invalidation tests**

Prime a summary key, perform a Room/Property/Incident write, and assert healthy Redis deletes the key only after commit. Then prime again, stop Redis before commit completion, perform a valid write, assert the PostgreSQL write succeeds, and assert cache telemetry records `delete_error` rather than surfacing a business failure.

- [ ] **Step 2: Run and verify RED**

Run: `pnpm exec tsx --test tests/integration/cache/organization-summary-invalidation.integration.ts`
Expected: FAIL because invalidator/wiring do not exist.

- [ ] **Step 3: Implement after-commit invalidation wiring**

Do not invalidate before commit. Do not add Redis calls inside SQL transactions. Do not use pattern deletes or `KEYS`.

- [ ] **Step 4: Verify rollback and failure semantics**

Add/verify a rollback case where the PostgreSQL transaction fails and the previously cached summary key remains untouched. Restore Redis, flush cache, and assert a subsequent read reconstructs the new authoritative PostgreSQL state.

- [ ] **Step 5: Commit**

```bash
git add src/read-models/organization-summary-cache-invalidator.ts src/persistence/guards src/modules tests/integration/cache/organization-summary-invalidation.integration.ts
git commit -m "feat(cache): invalidate summaries after commit"
```

### Task 5: Add cache health, flush-recovery verification, and final cache gate

**Files:**
- Create: `src/infrastructure/cache/cache-health.service.ts`
- Modify: `src/infrastructure/cache/cache.module.ts`
- Modify: `src/app.module.ts`
- Modify: `src/health.controller.ts`
- Modify: `package.json`
- Test: `tests/integration/cache/cache-health.integration.ts`
- Test: `tests/integration/cache/redis-flush-recovery.integration.ts`

**Interfaces:**
- `CacheHealthService.status(): Promise<'disabled' | 'up' | 'degraded'>`.
- Overall service health remains operational when Redis is `disabled` or `degraded` if PostgreSQL is healthy; response exposes Redis state separately.
- `AppModule` imports `CacheModule` and `ReadModelsModule`; `ReadModelsModule` exposes the cached summary service for current/future dashboard application code without inventing a new public route.
- `verify:cache` runs cache policy audit plus all `tests/integration/cache/**/*.integration.ts` after PostgreSQL persistence verification.

- [ ] **Step 1: Write health + full flush recovery tests**

Assert healthy Redis reports `up`; stopped Redis reports `degraded` without making PostgreSQL-backed application health fail; disabled config reports `disabled`. Prime organization summary in the dedicated test Redis instance/database, execute `FLUSHDB`, restart the app, and assert the same semantic summary is reconstructed from PostgreSQL.

- [ ] **Step 2: Run and verify RED**

Run: `pnpm exec tsx --test tests/integration/cache/cache-health.integration.ts tests/integration/cache/redis-flush-recovery.integration.ts`
Expected: FAIL because health/final wiring do not exist.

- [ ] **Step 3: Implement cache health and verification script**

Do not include Redis key/value contents in health output. `verify:cache` must fail on cache policy/naming violations but must not require Redis to be authoritative for any assertion.

- [ ] **Step 4: Run complete Redis gate**

Run: `pnpm verify:persistence && pnpm verify:cache`
Expected: PostgreSQL persistence gate PASS; cache tests PASS in healthy mode; explicit degraded-mode tests PASS; full Redis flush recovery PASS.

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/cache src/health.controller.ts package.json tests/integration/cache tests/audit/cache-policy.static.test.ts
git commit -m "chore(cache): add redis verification and health"
```

## Completion Gate

- Redis can be unavailable, flushed, or restarted without losing business state.
- PostgreSQL writes remain successful when cache invalidation fails.
- The only business cache namespace introduced by this plan is `dashboard:organization` with TTL 60 seconds.
- No Listing/Search state is cached.
- No transaction guard or authorization decision reads Redis.
- Every cache operation has namespace-level hit/miss/error/fallback observability.
- No runtime `KEYS` scan, infinite TTL, OPEN-policy answer, FUTURE capability, or level-number implementation naming is introduced.