# Isolated DemoPay Payment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Demonstrate an isolated tenant → DEMO browser confirmation → verified shared settlement → creator/owner notification → authenticated Android refresh flow.

**Architecture:** Extend the fixed registry and current checkout lifecycle, with a small DEMO adapter and signed expiring capability. Only explicit browser POST can mint internal DEMO evidence; shared settlement owns atomic Payment/link/recipient writes. MoMo protocol remains unchanged and SEPAY remains null.

**Tech Stack:** Existing NestJS/TypeScript, node:crypto, PostgreSQL/node-pg-migrate, Kotlin/Compose/Gson/JUnit; no new dependency.

**Spec:** `docs/superpowers/specs/2026-10-07-demo-payment-design.md`

Status: proposed executable plan for user review, not executed. Architecture approved on 2026-10-07; user authorized both written artifacts, with implementation explicitly deferred.

## Global constraints and baseline

- Product baseline is integration/v1-current at `492fefd14e2da6c47258cc844daba9d02ef13764`; planning commits may be docs-only descendants. Before execution record exact HEAD and verify only reviewed documentation differs from that baseline; stop on unexpected code/index/local changes.
- Re-read spec and user clarifications. Preserve local work, secret-bearing Task 0 backup and all local env files without opening them. No push/merge/amend/reset or design/app-ui-redesign changes.
- D0 → D1 → D2 → D3 → D4 → D5 → D6 is the execution order. D3 technically needs D0/shared settlement; D4 needs D1/D2 contracts; D5 needs D0–D4; D6 needs D5 and runtime prerequisites. Execute serially in this worktree, with fresh task review before the next boundary.
- DEMO disabled by default and forbidden in production. Rehearsal only on guarded trooi_test; never probe trooi_dev or start unrelated infrastructure. No MoMo/SePay provider calls or credentials. DEMO key is local simulated configuration only.
- Preserve MOMO signing/HMAC/result/finality/replay/legacy/204 behavior; owner notification is the one intentional shared behavior addition. SEPAY unavailable; B3/B4/B5 and SePay Task 3 remain blocked; no Task 4.
- Exact DEMO copy, route, identity, origin, capability and finance rules are pinned by the spec. No new table, allocation, deposit application or Receipt.
- Each task writes RED tests, records the expected failure, implements minimally, reruns GREEN gates, reviews the exact diff, then explicitly stages its file allowlist. Never git add -A. Required blocked gates stay BLOCKED and task completion/commit waits for review of that blocker; never silently waive them.
- If a source/runtime assumption is false, stop that task with evidence and propose a narrow spec/plan revision. Do not improvise architecture or relabel unexecuted checks PASS.

## Review focus

1. Expired CREATED URL or config/key rotation: authenticated same-key replay renews the same intent or fails closed; GET cannot renew (D1/D2).
2. Capability in exception URL or HTML: no raw token in errors/logs/referrers/cache, escaped dynamic fields (D2).
3. Creator access loss and incomplete owner relation: independent eligible recipients; relation integrity failure rolls back, no arbitrary fallback (D3).
4. Lost-response recovery, null/unknown hint provider and response mismatch: no silent MOMO fallback; method switch uses a fresh key (D4).
5. Confirmation racing URL renewal and second recipient failure: terminal Payment/link immutable, no duplicate notification or partial transaction (D3/D5).

## D0 — Schema, contracts and provider primitives

**Files:**
- Create `database/migrations/000006_demo_gateway.ts`, `database/migrations/sql/000006_demo_gateway.up.sql`, `database/migrations/sql/000006_demo_gateway.down.sql`.
- Modify `src/persistence/ports/gateway-checkout.types.ts`, `src/persistence/ports/finance.repository.ts`, `src/modules/payment-gateway/providers/gateway-provider.ts`, `src/modules/payment-gateway/providers/gateway-provider.registry.ts`, `src/modules/payment-gateway/dto/index.ts`.
- Test/create `tests/integration/persistence/demo-gateway-migration.integration.ts`; modify `tests/integration/persistence/migration-parity.integration.ts`, `tests/core/dto-boundary.validation.test.ts`.

**Interfaces:** GatewayProvider adds DEMO; GatewaySnapshotBinding adds DEMO/null; record/evidence stage unions add DEMO_CONFIRMATION. Registry reserves DEMO:null until D1. No change to repository public API or existing evidence constructors.

- [ ] Write RED assertions: DEMO DTO accepted while null/unknown rejected; DEMO row with NULL snapshot accepted; nonnull snapshot rejected; trans ID must equal 'DEMO-'+checkoutId.replace(/-/g,''); other checkout's ID/arbitrary text rejected; stage DEMO_CONFIRMATION cannot cross provider. Existing MOMO numeric and SEPAY opaque/scope rules unchanged.
- [ ] On available guarded trooi_test, run `pnpm exec tsx --test tests/integration/persistence/demo-gateway-migration.integration.ts` and DTO test; capture RED before migration/type edits. Validate TEST_DATABASE_URL pathname equals trooi_test before connect; do not output URL credentials.
- [ ] Implement narrow CHECK replacement, no rows/columns/table rewrite; down refusal before DDL, restoring exact 000005 constraints. Leave 000001–000005 untouched. Keep existing snapshot/remote/handoff invariants for SEPAY.
- [ ] Fix migration-parity test positioning: currently optional_sepay_upgrade_preserves_momo_rows rewinds only if latest is 000005. Rewind empty 000006 first, then 000005, assert target revision, seed existing MoMo cases, upgrade all and retain row equality/public29 assertions. Do not weaken the old regression to accommodate new migration.
- [ ] Run `pnpm test:persistence:migration`, new migration suite, `pnpm exec tsx --test tests/core/dto-boundary.validation.test.ts`, `pnpm typecheck`, `pnpm lint`. Direct SQL: prove valid/malformed DEMO, provider stage isolation, transaction uniqueness, down refusal preserving history, no-DEMO down/up and unchanged public29; serial disposable fixture only.
- [ ] Review before/after legacy/INITIATED/CREATED/SUCCEEDED MOMO and SEPAY snapshots/IDs/fingerprints/payment links. Record exact byte hashes for 000001–000005. Expected GREEN: only additive DEMO acceptance, no prior row change.
- [ ] Commit explicit D0 files: `feat(payment): add demo gateway storage contracts`.

## D1 — DemoGatewayAdapter and signed capability

**Files:**
- Create `src/modules/payment-gateway/demo/demo-config.ts`, `src/modules/payment-gateway/demo/demo-capability.ts`, `src/modules/payment-gateway/providers/demo-gateway.adapter.ts`, `tests/core/demo-gateway.behavior.test.ts`.
- Modify `.env.example`, `src/modules/payment-gateway/providers/gateway-provider.registry.ts`, `src/modules/payment-gateway/payment-gateway.module.ts`, `src/modules/payment-gateway/services/payment-gateway.service.ts`, `src/infrastructure/database/repositories/finance.repository.ts`.
- Modify `tests/core/support/in-memory-transaction-manager.ts` only to reflect the narrowly extended DEMO CREATED lease predicate; preserve existing rollback/lock semantics.

**Interfaces:** `loadDemoConfig(env: NodeJS.ProcessEnv): DemoConfig | null`; DemoConfig has publicBaseUrl/signingKey. Capability helpers `signDemoCapability(record: GatewayCheckoutRecord, config: DemoConfig, now: Date): string`, `verifyDemoCapability(token: string, config: DemoConfig, now: Date): DemoCapability`, `demoIntentDigest(record): string`. DemoCapability contains fixed version/provider/purpose, checkoutId, exp, intentDigest. DemoGatewayAdapter implements current interface plus `verifyCompletion(token: string, record: GatewayCheckoutRecord): VerifiedGatewayEvidence` and `readCapability(token: string): DemoCapability`; injected GATEWAY_CLOCK supplies deterministic expiry. Helpers never return trusted settlement evidence themselves.

- [ ] Add RED anchors demo_provider_disabled_by_default, demo_provider_rejected_in_production, demo_checkout_uses_shared_gateway_boundary, demo_tampered_or_expired_capability_never_settles, sepay_remains_unavailable, omitted_provider_remains_momo. Assert wrong purpose/provider/key/digest/ID/expiry rejected; no Payment on create; generic callbacks throw and cannot mint evidence.
- [ ] Run `pnpm exec tsx --test tests/core/demo-gateway.behavior.test.ts`; capture missing-provider/capability failures.
- [ ] Implement lazy config and nonsecret template placeholders; production/missing/invalid config returns null. Explicit registry injects available DEMO only. No external client or network implementation.
- [ ] Implement fixed canonical JSON payload, HMAC of encoded bytes, strict canonical round-trip/field validation and timing-safe MAC. Bind immutable tuple from spec. Use independent stdlib HMAC fixture assertions with dummy key; valid/invalid URL config tests must not read environment files.
- [ ] Add DEMO coordinator allowlist while retaining conflict-before-availability/default MOMO. Add adapter immutable intent and local handoff; evidence subclass is private to adapter verifier and contains stored identity, deterministic settlement ID, DEMO_CONFIRMATION, null result code and token-free observation.
- [ ] Extend existing lease SQL and in-memory fixture only for DEMO CREATED capability renewal. Existing same-key valid URL returns same intent; expired/invalidated URL may be renewed via authenticated POST only, terminal cannot dispatch. Preserve existing MOMO predicates/31-day behavior and guard late handoff completion under checkout lock.
- [ ] Add RED then GREEN renewal/config-loss/concurrent lifecycle tests. Run demo tests, existing payment-gateway behavior, `pnpm typecheck`, `pnpm lint`, `pnpm build`. Expected GREEN: stable checkout/key/fingerprint/settlement identity across replay; SEPAY null; no provider calls.
- [ ] Commit explicit D1 files: `feat(payment): add isolated demo gateway provider`.

## D2 — Read-only browser page and explicit confirmation

**Files:**
- Create `src/modules/payment-gateway/controllers/demo-payment.controller.ts`, `src/modules/payment-gateway/services/demo-payment.service.ts`, `tests/core/demo-gateway.http.test.ts`.
- Modify `src/modules/payment-gateway/payment-gateway.module.ts`, `src/common/filters/http-exception.filter.ts`; extend `tests/core/support/payment-gateway-http-harness.ts` narrowly for actual DEMO module/controller/config injection as needed.

**Interfaces:** `DemoPaymentService.readPage(token: string): Promise<GatewayCheckoutRecord>` verifies token before direct read and immutable binding; `confirm(token: string): Promise<void>` verifies and calls GatewaySettlementService.settle. Controller GET/POST routes from spec use raw Express Response, generic controller-owned errors and security headers. TransformInterceptor is unchanged; HttpExceptionFilter only redacts token-bearing DEMO paths, preserving non-DEMO behavior.

- [ ] Add RED HTTP anchors demo_handoff_get_is_read_only, demo_success_creates_one_verified_gateway_payment, demo_duplicate_success_is_idempotent, demo_return_or_cancel_never_settles. Assert real Nest public route GET leaves entire row/Payment/notification unchanged; POST creates one correct Payment/link; duplicate same identity returns recorded success.
- [ ] Run `pnpm exec tsx --test tests/core/demo-gateway.http.test.ts`; expected RED absent routes.
- [ ] Implement GET direct repository read (not coordinator.findCheckout), explicit POST verifier→settlement, raw HTML and ordinary POST form. Return/cancel links only; no cancel write/API. Escape reference/amount/attributes and display exact simulated copy before and after confirmation.
- [ ] Add RED tests for bad/expired token before lookup, wrong Origin when supplied, config disabled after issuance, HTML injection, security headers, route token absent from error bodies/logs and generic unexpected persistence failure. Include malformed and oversized application/json POST errors generated before controller invocation; global filter must redact the entire DEMO capability segment/query and preserve ordinary/MoMo error paths. Catch/shape controller errors without raw request.url; do not include token in exception messages. Raw HTML must bypass JSON wrapping while normal JSON and MoMo empty204 remain unchanged.
- [ ] Run demo behavior/HTTP, existing payment-gateway HTTP and manual-payment HTTP, typecheck/lint/build. Expected GREEN: GET/return/cancel zero writes, only explicit verified POST settles, no JSON envelope around HTML or token leakage.
- [ ] Commit explicit D2 files: `feat(payment): add signed demo browser confirmation`.

## D3 — Independent creator and primary-owner notification fan-out

**Files:** Modify `src/modules/payment-gateway/services/gateway-settlement.service.ts`, `tests/core/payment-gateway.behavior.test.ts`, `tests/core/payment-gateway.http.test.ts`, `tests/core/demo-gateway.behavior.test.ts`, `tests/core/demo-gateway.http.test.ts`. Extend `tests/core/support/in-memory-transaction-manager.ts` only for needed rollback/failure fixtures.

**Interfaces:** Existing `GatewaySettlementService.settle(evidence): Promise<void>` unchanged. Use TransactionContext.repositories tenancy/property/organization/notification; no new public service or adapter notification method.

- [ ] Write RED anchors demo_success_creates_owner_and_creator_notifications, demo_same_creator_and_owner_is_deduplicated, demo_notification_failure_rolls_back_settlement, demo_success_creates_no_allocation_deposit_application_or_receipt. Assert two distinct eligible recipients, one identical recipient, exact source payment:<resultingPaymentId>, empty financial side effects.
- [ ] Add regression creator_loses_read_access_owner_still_notified: creator notification count 0, owner count 1, successful Payment/link. Add missing room/property/org/owner integrity rollback and unexpected creator-auth failure rollback cases.
- [ ] Run demo/core payment behavior; capture RED creator-only/early-return behavior.
- [ ] Replace creator ForbiddenException early return with creator omission only. Independently traverse canonical owner relations inside same transaction, throw on integrity failure, deduplicate Set of eligible IDs, insert notifications. Keep verified settlement lock/terminal/Payment flow unchanged.
- [ ] Inject failure on second recipient write; assert first notice, Payment and link all rollback; retry commits one complete fan-out. Already committed duplicate writes no new notification. Update MoMo creator-only assertions to new intentional recipient set without weakening HMAC/actor/finality assertions.
- [ ] Run demo suites plus `pnpm exec tsx --test tests/core/momo-hmac.test.ts tests/core/momo-client.test.ts tests/core/momo-result.test.ts tests/core/payment-gateway.behavior.test.ts tests/core/payment-gateway.http.test.ts tests/core/manual-payment.http.test.ts`, typecheck/lint/build. Expected GREEN: protocol preserved, eligible owner added across providers, creator access loss does not suppress owner.
- [ ] Commit explicit D3 files: `feat(payment): notify rental owner on confirmed gateway payment`.

## D4 — Android provider identity, selection and authenticated return

**Files:**
- Create `app/src/main/java/com/trooi/app/features/shared/GatewayProvider.kt`, `app/src/test/java/com/trooi/app/features/shared/V1PaymentGatewayTest.kt`, `app/src/test/java/com/trooi/app/features/notifications/PaymentNotificationPresentationTest.kt`.
- Modify `app/src/main/java/com/trooi/app/features/shared/V1PaymentGateway.kt`, `app/src/main/java/com/trooi/app/features/tenancy/CheckoutFlow.kt`, `app/src/main/java/com/trooi/app/features/tenancy/RentalViewModel.kt`, `app/src/main/java/com/trooi/app/features/tenancy/RentalWorkspace.kt`.
- Modify `app/src/main/java/com/trooi/app/core/auth/SessionRestore.kt`, `app/src/main/java/com/trooi/app/core/auth/SessionHintsStore.kt`, `app/src/main/java/com/trooi/app/features/notifications/NotificationScreens.kt`, `app/src/main/AndroidManifest.xml`, `app/build.gradle.kts`.
- Test/modify `app/src/test/java/com/trooi/app/features/tenancy/CheckoutFlowTest.kt`, `app/src/test/java/com/trooi/app/core/auth/SessionRestoreTest.kt`, `app/src/androidTestBackendDebug/java/com/trooi/app/features/SessionHintsPersistenceTest.kt`.

**Interfaces:** GatewayProvider enum MOMO/SEPAY/DEMO. `V1PaymentGateway.create(tenancyId, amount, key, provider: GatewayProvider? = null)`; CheckoutIntent/PendingCheckoutHint trailing `provider: GatewayProvider = MOMO`. Extend rememberCheckoutBeforePost with trailing defaulted provider and provider-aware key reuse. `decodePendingProvider(raw: String?, fieldPresent: Boolean): GatewayProvider?` means absent=MOMO, present invalid=null/fail closed. Dedicated `launchableDemoPayUrl(payUrl, configuredOrigin, backendDebug): String?` leaves launchableHttpsPayUrl unchanged. Add nonsecret `DEMO_PAYMENT_PUBLIC_ORIGIN` BuildConfig populated by `trooiDemoPaymentPublicOrigin` / process `DEMO_PAYMENT_PUBLIC_BASE_URL`, default blank and blank/disabled outside backendDebug.

- [ ] Write RED unit tests for omitted JSON provider vs explicit DEMO, legacy absent hint=MOMO, exact known providers, null/unknown/non-string hint rejection, response-provider mismatch before launch/store/confirm, method switch fresh key, same method same key, forged return only refresh, exact origin with hostile suffix/userinfo/port/scheme/path rejection. Use existing MockWebServer/transport fixtures, no provider calls.
- [ ] Run `./gradlew.bat :app:testBackendDebugUnitTest`; expected RED missing provider/recovery behavior.
- [ ] Add provider persistence/serialization with trailing defaults; invalid hint cannot auto-replay. Android response mismatch must fail before applyCheckout stores returned ID or opens URL. Known SEPAY stays identity-preserved but unavailable. Add nonsecret provider to SessionHintsStore JSON, never payUrl/token.
- [ ] Add explicit backendDebug selection with DemoPay / MÔ PHỎNG copy; switching creates new intent/key and does not mutate old checkout. Launch DEMO using dedicated exact configured origin; MoMo function/hosts preserved. Add /demo manifest/return recognition; query parameters never set paid or select ID/provider. Existing revision guards and authenticated refresh/Payment-list corroboration remain.
- [ ] Add PAYMENT_CONFIRMED presentation helper in NotificationScreens.kt for exact Vietnamese title/body; list/detail use it without changing stored source/navigation. Unit-test those strings and preserved source metadata. No broader UI redesign.
- [ ] Run `./gradlew.bat :app:testBackendDebugUnitTest :app:assembleBackendDebug :app:lintBackendDebug`. Expected GREEN reports; preserve old call sites and MOMO recovery tests. Instrumented hint round-trip is recorded later, not claimed from unit tests.
- [ ] Review additive APIs and commit explicit D4 files: `feat(android): add simulated gateway payment flow`.

## D5 — PostgreSQL concurrency and complete regression evidence

**Files:** Create `tests/integration/persistence/demo-gateway-concurrency.integration.ts`; modify `tests/integration/persistence/gateway-test-support.ts`, `tests/integration/persistence/payment-gateway.integration.ts`, `tests/integration/persistence/payment-gateway-concurrency.integration.ts` only for updated eligible recipient assertions/fixtures. Reuse D0 migration test file.

**Interfaces:** Use real PostgresTransactionManager and existing lock/barrier/latch helpers; two independent pools, dummy DEMO key/config and current adapter/settlement. No provider server/mock network substitutes for PostgreSQL evidence.

- [ ] Write RED storage/concurrency assertions for one Payment/link/stable trans ID under simultaneous explicit confirmations, two eligible recipient notices, duplicate no resend, creator=owner one notice, creator-ineligible owner still notified, second-recipient persistence failure atomic rollback/retry and zero Allocation/Deposit application/Receipt. Add URL-renewal versus settlement race; final SUCCEEDED/link cannot be erased.
- [ ] Validate already-authorized TEST_DATABASE_URL targets trooi_test before connect. If absent/unavailable, stop this gate as BLOCKED; no Docker startup or fallback DB.
- [ ] Run each destructive suite separately, serially: `pnpm test:persistence:migration`; `pnpm exec tsx --test tests/integration/persistence/demo-gateway-migration.integration.ts`; `pnpm exec tsx --test tests/integration/persistence/payment-gateway.integration.ts`; `pnpm exec tsx --test tests/integration/persistence/payment-gateway-concurrency.integration.ts`; `pnpm exec tsx --test tests/integration/persistence/demo-gateway-concurrency.integration.ts`.
- [ ] Coordinate barriers/held row lock and prove an actual PostgreSQL lock waiter before release; do not rely on sleeps or sequential in-memory duplicates. Assert final persisted counts/identities, rollback state and unchanged legacy/provider constraints/public29.
- [ ] Rerun complete DEMO/MoMo/core/HTTP/DTO suites, existing SePay offline `tests/core/sepay-protocol.test.ts`, typecheck/lint/build and D4 Android gates. Capture exact counts/commands/revision, no inferred PASS.
- [ ] Review diffs; if real defects appear, fix only the owning boundary, rerun affected gates and obtain fresh review. Commit explicit D5 test files: `test(payment): verify demo settlement concurrency and isolation`.

## D6 — Isolated backendDebug rehearsal and final exact-HEAD receipt

**Files:** Create `docs/testing/demo-payment-20261007.md`; if repeatable rehearsal needs code, create `tests/e2e/demo-payment-runtime.ts` and `tests/e2e/maestro/demo-payment.yaml`. Do not repurpose existing v1-integration-runtime synthetic auth/HTTP harness evidence as real-device Google-auth proof.

**Interfaces:** Production controllers/settlement wired to isolated trooi_test dataset, existing authenticated tenant/owner sessions, backendDebug app pointing to that backend and explicit DEMO origin. Runtime script may orchestrate local application HTTP only with supplied nonlogged auth; no external provider calls or injected trusted evidence/direct settlement.

- [ ] First record prerequisites/status: existing guarded DB availability, reachable backend origin, demo-only key via process env, installed backendDebug, available device/emulator and authorized authenticated tenant/owner contexts. Missing authentication must be reported; do not weaken AuthGuard/add demo login or use provider credentials. Do not read local .env.
- [ ] Add a failing local runtime assertion for full browser POST → authenticated checkout SUCCEEDED → Payment → owner/creator sources, using actual application endpoints. Seed only guarded test fixture with distinct owner/tenant, record IDs without tokens; prevent accidental operational reset. No fixed pause as settlement proof.
- [ ] With prerequisites available, tenant selects visibly simulated DEMO, creates checkout and opens real browser page. Record pre-confirmation GET/close/return has no Payment. Explicitly confirm, refresh Android and show backend-confirmed state without claiming invoice paid off. Switch to owner context and open human-readable PAYMENT_CONFIRMED source. Record dedup/rollback/concurrency as D5 database evidence, not unexecuted UI claims.
- [ ] Verify access/proxy logs exclude capability paths; artifacts/screenshots must be redacted, outside repo. If a browser automation tool is needed, use only an already-authorized route; seek required tool authorization before dependent action, not a substitute claim. Execute Maestro flow only when available; otherwise record BLOCKED/UNVERIFIED.
- [ ] If connected environment exists, run `./gradlew.bat -PtrooiInstrumentationBuildType=backendDebug :app:connectedBackendDebugAndroidTest`; report raw results separately, including unrelated auth/map prerequisites, never claim a native DEMO browser test from unrelated source-navigation tests. Run DEMO flow on available device and record tool/device/build identity.
- [ ] Write nonsecret receipt: simulated/non-production warning; exact flow/security/finance/recipients; commands/pass-fail counts; pre/post persisted counts; migration/public29; MoMo unchanged except owner fan-out; SEPAY unavailable and B3/B4/B5 blocked; every runtime/device blocker. Initial evidence is UNEXECUTED, not PASS.
- [ ] Run git diff --check, inspect explicit files, confirm no env/credentials/provider protocol/design-branch edits, stage receipt and optional reviewed rehearsal files only. Commit `docs(payment): record isolated demo payment verification` (test/evidence changes only).
- [ ] Revalidate final exact HEAD/branch/status, list files per new commit with git show --name-only, and compare final tree/build artifacts with tested revision. Rerun affected gates if commit changed executable bytes; docs-only final commit can reference unchanged tested product tree plus its SHA/diff. Receipt must name tested revision, never prewrite a future commit hash.
- [ ] Stop for coordinator review. Report implementation-review status separately from rehearsal status and explicitly approved external blockers; no READY_TO_MERGE/full-demo claim with required unexecuted gates. No push, merge or SePay Task 4.

## Planning self-review and handoff

Coverage: D0 storage/provider boundaries, D1 configuration/capability/renewal, D2 browser trust boundary, D3 independent recipients/atomicity, D4 provider recovery/UI, D5 PostgreSQL and regressions, D6 exact-HEAD rehearsal receipt. No production/runtime/test changes are made by writing this plan; all task checkboxes remain unchecked.

Source differences accounted for: creator early-return must be removed; current hints omit provider; current MoMo-only URL launcher stays intact; global interceptor wraps normal responses and exception filter exposes raw request.url; migrations tests assume 000005 is latest. These are targeted implementation concerns, not permission to change SePay gates or weaken existing tests. Owner relation failure is explicitly rollback, not silent omission.

The user has approved the design and authorized writing this plan. Written-artifact review remains the next boundary; do not invoke an implementation skill or execute D0 until the user approves this plan. Recommend the existing subagent-driven method, one task and fresh review at a time; no parallel dependent tasks in this worktree.
