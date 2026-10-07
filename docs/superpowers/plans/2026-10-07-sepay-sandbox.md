# SePay Sandbox alongside MoMo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** APPROVED by the user on 2026-10-07 after reviewer revisions. The Task 0 receipt was reviewed and approved; required contract guarantees remain unresolved and Sandbox acceptance is UNVERIFIED. Task 1 has not started and remains outside this documentation checkpoint.

**Goal:** Add optional SePay Payment Gateway Sandbox beside behavior-compatible MoMo, with durable checkout, verified server evidence and at-most-once Payment.

**Architecture:** Two small provider adapters wrap the existing coordinator; one settlement helper owns atomic money writes. SePay landing GET is read-only; explicit browser POST dispatch claims an attempt before releasing its provider form. Independent API/public origins, authenticated IPN/read-back and contract-gated explicit same-invoice resume preserve uncertainty safely. MoMo retains strict HMAC and its existing flow.

**Tech Stack:** Current NestJS/TypeScript, Node crypto/fetch, Kysely/PostgreSQL, Android Kotlin/Compose/Gson/SharedPreferences. Preserve current toolchain/lockfiles; no payment SDK/framework/queue dependency is planned.

**Spec:** [2026-10-07-sepay-sandbox-design.md](../specs/2026-10-07-sepay-sandbox-design.md).

**Execution baseline:** `integration/v1-current` at `48d6420a9ecebd204933b6ad6b73d374d8bdc812`, clean tracked tree. Work here, not on the older payment worktree: hardened backend, Android context/restore/payment and runtime tests are already integrated. Preserve any newly present local `.env`/other work. Revalidate HEAD before starting; report/revise if contract facts or file inventory changed. Tasks are serial in this worktree. Each task: red → minimal implementation → green required gates → review diff → explicit-file commit; no `git add -A`, force push, main merge, or push without fresh authorization.

## Global Constraints

- `GatewayProvider = 'MOMO' | 'SEPAY'`; missing provider defaults MOMO. Existing-key fingerprint conflict is enforced before provider availability/config, including disabled SEPAY; a matching key retains its original intent.
- Charge is receivable; provider-verified Payment is separate from Checkout, Allocation, Claim, Deposit and Receipt. No automatic downstream money operation.
- MoMo verification, omitted-provider clients, fingerprints, existing snapshots/IDs, 204 ACK, result-code/finality and 31-day replay semantics remain compatible.
- SePay Payment Gateway Sandbox only; PURCHASE/BANK_TRANSFER/VND, isolated nonproduction finance. No bank-webhook HMAC assumption or production fallback.
- Whole VND `[1000,50000000]` is initial local policy, subject to confirmed Sandbox support, not an invented SePay published range.
- Provider network I/O outside checkout transactions; row locks/uniqueness and atomic Payment/link/authorized creator notification remain mandatory.
- No Payment from return URI/form creation, unknown status, API timeout or incomplete transaction evidence.
- Forward migration only, public29 unchanged, SePay rollback refuses existing SEPAY rows; never fabricate old MoMo snapshots.
- Preserve Google token memory-only restore/context safeguards, Compose redesign and the minSdk/compileSdk/toolchain currently present.
- Tasks1–7 including Task5 use deterministic local HTTP/Postgres/pure fixtures/internal normalized evidence, with no provider network or credentials. All actual SePay API/form/IPN execution belongs to Task8; no fabricated provider HTTP server/success response. Existing MoMo test doubles remain regressions, never acceptance evidence.
- Missing contract is a blocker for behavior relying on it. External credentials/provider/device gates remain UNVERIFIED; explicit per-gate approved deferrals can permit merge with impacted capability safely gated, never unsafe finance or failed automated tests. Full V1 acceptance remains separate.
- GET landing makes zero writes/provider calls; POST dispatch atomically advances one expected attempt. Claimed recovery never clears claim or treats404 as proof; resume needs verified same-invoice replay safety.
- Android API origin A and pinned public HTTPS origin B may differ; B must route to the same backend/dataset and match SEPAY_PUBLIC_BASE_URL. Provider origin C is fixed and separate.

## Review Focus

- Default provider/config changes must not silently move old clients or mask an existing-key conflict behind provider unavailability (Tasks 1–2).
- Same key across providers, merchant namespaces and colliding provider IDs must not select or settle another intent (Tasks 1,4–5).
- Prefetched GET must not claim; POST followed by process/network loss must retain invoice and provide contract-gated explicit recovery, never guessed absence/new invoice (Tasks 4–6).
- Shared-secret IPN with a plausible forged amount/status must not settle without corroborated merchant API evidence (Tasks 3–5).
- Account/context change and replacing an unresolved local hint must not lose recovery or mark another provider paid (Task 6).

## File/ownership map and order

New provider/storage types: `src/persistence/ports/gateway-checkout.types.ts`. New adapter contract/registry and provider implementations: `src/modules/payment-gateway/providers/{gateway-provider.ts,gateway-provider.registry.ts,momo-gateway.adapter.ts,sepay-gateway.adapter.ts}`. SePay protocol modules: `sepay/{sepay-client.ts,sepay-form.ts,sepay-verification.ts}`. Shared settlement: `services/gateway-settlement.service.ts`. Browser boundary: `controllers/sepay-handoff.controller.ts`, `sepay/sepay-handoff.ts`. New DTO: `dto/sepay-ipn.dto.ts`. Forward migration: `000005_optional_sepay_gateway.ts` and matching SQL. No files are created solely as unused scaffolding.

Dependency chain: **0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9**. Migration precedes backend release; SePay stays disabled for general use until Task8 contract/recovery/live acceptance succeeds. Task0 is official-contract verification without provider execution; unresolved details block their dependent behavior. Task8 owns every actual Sandbox/API/IPN run; Task9 consumes its valid receipt or reopens Task8 if source/config/artifact changed. Task9 can reconcile explicitly approved external deferrals if Task8 is externally blocked, not claim its missing evidence PASS.

### Task 0: Resolve SePay Gateway contract and preserve baseline

**Depends:** approved spec/plan. **Files:** create `docs/testing/sepay-gateway-contract-20261007.md`; read official sources listed in spec§3, current migrations and ignored config (presence only). Probe artifacts/receipts outside repo.

**Produces:** documented form ordering/canonical signer fixture, invoice/replay guarantees, lookup/transaction identity, statuses and `SepayIpnResponsePolicy` matrix (category→verified status/body/retry semantics), plus unresolved contract blockers. Official docs/source or written provider confirmation establish these facts; example success200 does not establish failure statuses. No Sandbox execution occurs here.

- [ ] Record `git rev-parse HEAD`, branch/status/worktrees and migration inventory. Backup local/staged work explicitly; do not reset/stash user data. Inventory configuration presence only, without printing values; actual merchant/API/HTTPS/device execution is Task8.
- [ ] Revalidate official Gateway docs and pinned SDK source; obtain written clarification for lookup/identity/duplicate-invoice issues and proof that same-invoice resume cannot create a second order/charge, including late-success races. Do not call Sandbox APIs, submit forms or trigger IPNs; actual compatibility probes are Task8.
- [ ] Pin IPN failure matrix covering invalid authentication/shape, unknown invoice, mismatched identity/terminal outcome, unsupported notification, upstream uncertainty and DB failure. Do not infer401/409/503 from generic HTTP or MoMo. If not confirmed, block the dependent IPN mapping/channel; preserve internal failure semantics and zero money writes.
- [ ] Write contract receipt with exact source revisions, commands, result/UNVERIFIED and artifact paths. If a required fact cannot be established, stop its dependent tasks and revise this spec/plan; keep unknowns explicit.
- [ ] Review receipt; commit only this document: `docs(payment): pin verified sepay sandbox contract`.

**Expected:** contract-backed constants/policies or precise unresolved blockers; no network/provider acceptance claimed. Missing credentials are Task8 external prerequisites, not a reason to skip deterministic Tasks1–7; missing protocol guarantees still block the dependent behavior.

### Task 1: Forward migration and provider storage model

**Depends:** 0. **Create:** `database/migrations/000005_optional_sepay_gateway.ts`, `database/migrations/sql/000005_optional_sepay_gateway.{up,down}.sql`, `src/persistence/ports/gateway-checkout.types.ts`. **Modify:** finance port/Postgres repository, contracts/index.ts, dto/index.ts, in-memory transaction manager, migration-parity integration test; migrate only necessary type callers identified by typecheck.

**Produces:** `GatewayProvider`; row-provider-discriminated snapshot union `MomoRequestSnapshot | SepayRequestSnapshot | null`; nullable `providerRemoteOrderId`, `handoffClaimedAt` and monotonic `handoffAttempt` default0. `findGatewayCheckoutByProviderInvoice(provider,merchantScope,invoice)`, distinct `findGatewayCheckoutByRemoteOrderId(provider,merchantScope,remoteId)`; atomic `claimGatewayHandoff(id,expectedAttempt,now): Promise<boolean>` increments once under eligible action/state; stage adds RECONCILIATION. Existing MoMo snapshots/IDs are not rewritten.

- [ ] RED real migration tests: upgrade old legacy/INITIATED/CREATED/SUCCEEDED MoMo rows without changed fingerprints/snapshots/Payment links; inserting SEPAY fails on old constraints. Assert provider-mismatched snapshot, invalid MoMo transId and mutable intent are rejected; two providers' equal raw external IDs never misroute.
  Named anchors: `optional_sepay_upgrade_preserves_momo_rows`, `provider_snapshot_mismatch_is_rejected`, `sepay_down_refuses_existing_rows`, `local_invoice_collision_rejected_before_handoff`, `remote_id_scopes_and_roles_are_distinct`; assert public29 and unchanged MoMo IDs/fingerprint/resultingPaymentId. Equal local invoice remains globally rejected; equal remote IDs cross-scope allowed, same-scope rejected; equal invoice/remote strings never imply the same lookup role.
- [ ] Implement forward conditional constraints, one-time remote/first-claim binding, monotonic attempt CAS, distinct scoped invoice/remote lookups, opaque settlement ID uniqueness and provider-conditional lease predicate. Preserve global local-invoice/result guards and MoMo numeric/range/31-day behavior. New SEPAY invoice allocation collision may retry UUID only before initial persistence/handoff; existing-key invoice never changes. Down refuses SEPAY rows.
- [ ] Add optional request provider validation with MOMO default at service boundary; no channel activation in this task. Explicit null/unknown rejected; no enum reinterpretation of old hints.
- [ ] GREEN: `pnpm test:persistence:migration`; `pnpm exec tsx --test tests/core/dto-boundary.validation.test.ts`; `pnpm typecheck`; `pnpm lint`. Run migration reset files serially on guarded `trooi_test`; verify direct SQL constraints and repeat migration/public29. Down/up only disposable DB without SEPAY rows; test refusal separately.
- [ ] Review exact diff; commit listed/necessary files: `feat(payment): add forward storage support for optional sepay`.

**Expected:** both shapes persist safely while existing MoMo behavior remains the only active provider.

### Task 2: Extract minimal adapter and settlement boundaries with MoMo regression

**Depends:** 1. **Create:** provider contract/registry/MoMo adapter and gateway-settlement service paths above. **Modify:** payment-gateway service/module/index, MoMo client type import as needed, gateway controller/DTO summaries, core gateway behavior/HTTP tests and test harness, existing PostgreSQL gateway tests/support and runtime construction callers.

**Interfaces:** `PreparedGatewayIntent` binds provider/snapshot/merchantScope/invoice/requestId; `PreparedHandoff` binds local readiness + optional verified URL/outcome. `GatewayProviderAdapter.prepareIntent`, `prepareHandoff`, `replayReason`, `authenticateNotification`, `verifyNotification` use the signatures in spec§4. `GatewaySettlementService.settle(evidence: VerifiedGatewayEvidence): Promise<void>` owns locked transaction; evidence includes exact identity, amount, outcome, stage and stable success ID. Registry has exactly MOMO and later SEPAY, not dynamic plug-ins.

- [ ] RED tests: omitted/explicit MOMO equivalence; existing user/key changed provider/tenancy/amount409 even when selected provider disabled or snapshot preparation throws; matching key returns same intent when configuration disappears. Assert fingerprint lookup/conflict occurs before availability/snapshot work; retain actor authorization, stale-lease/finality and callback provider isolation.
  Named anchors: `omitted_provider_remains_momo`, `existing_key_conflict_precedes_unavailable_provider`, `matching_key_survives_config_loss`, `provider_callback_cannot_cross_settle`; retain MoMo204 and final-failure assertions.
- [ ] Wrap existing client/verifier/classifier without editing HMAC field sets or verification logic. Preserve MoMo amount validation/error behavior and signature failure blocker. Extract atomic helper; it rereads immutable binding, applies terminal rules and uses existing creator authorization. No alternate unsigned fallback or generic result-code mapping.
- [ ] GREEN: `pnpm exec tsx --test tests/core/momo-hmac.test.ts tests/core/momo-client.test.ts tests/core/momo-result.test.ts tests/core/payment-gateway.behavior.test.ts tests/core/payment-gateway.http.test.ts tests/core/manual-payment.http.test.ts`; serial existing payment PostgreSQL files; `pnpm typecheck`; `pnpm lint`; `pnpm build`.
- [ ] Review provider isolation/money diff; commit: `refactor(payment): isolate momo adapter and atomic settlement`.

**Expected:** existing MoMo/offline/runtime tests remain valid; no SePay payment capability enabled yet.

### Task 3: SePay signed form and trusted evidence adapter

**Depends:** 2. **Create:** `sepay/sepay-form.ts`, `sepay/sepay-client.ts`, `sepay/sepay-verification.ts`, `providers/sepay-gateway.adapter.ts`, `dto/sepay-ipn.dto.ts`, `tests/core/sepay-protocol.test.ts`, `tests/core/sepay-verification.test.ts`, nonsecret golden fixtures under `tests/core/fixtures/sepay-*`. **Modify:** module/registry/DTO exports and `.env.example` only; no local `.env` changes or SDK dependency.

**Interfaces:** `loadSepayConfig(env): SepayConfig`; `signSepayFields(orderedFields,secret): string`; `SepayClient.readOrder(record): Promise<SepayOrderEvidence>` uses confirmed Task0 lookup/correlation; `verifySepayNotification(headers,payload,record,apiEvidence): VerifiedGatewayEvidence`; adapter `reconcile(record)`. API origin/lookup keys derive only from config/stored binding, never untrusted payload URL.

- [ ] RED golden tests using Task0 pinned signer facts: canonical insertion order/Base64, wrong secret/order, escaping/no trusted custom_data. Negative IPN/API tests for missing/wrong secret, negative/fraction/unsafe amount, wrong provider/invoice/merchant/currency/method, mismatched aliases, CAPTURED without approved transaction, pending/unknown/ambiguous/partial/extra payment and timeout. Explicit offline fixtures cannot satisfy live gates.
  Named anchors: `ordered_form_matches_independent_hmac`, `authenticated_ipn_requires_api_corroboration`, `captured_without_approved_payment_is_unresolved`, `unknown_or_ambiguous_transaction_never_settles`; failed authentication never queries/writes money; provider-facing status expectations come only from Task0's response matrix.
- [ ] Implement stdlib crypto/fetch; fixed sandbox endpoints/HTTPS/no redirects/default5s query timeout; Basic Auth backend-only. SECRET_KEY validation timing-safe before lookup/query; lazy unavailable config so startup/manual/MoMo survive. Sandbox-only config validates credential relationship proved in Task0, rejects NODE_ENV=production and requires decoded database name trooi_sandbox (trooi_test only for NODE_ENV=test). Test unavailable configuration does not disable other channels. Normalize only verified exact evidence; API status strings do not become MoMo result codes.
- [ ] Add env placeholders specified in spec§8, with no credentials. Persist/redact only minimal evidence, no card/customer/IP/free-form body or secret headers.
- [ ] GREEN pure fixtures: `pnpm exec tsx --test tests/core/sepay-protocol.test.ts tests/core/sepay-verification.test.ts tests/core/momo-hmac.test.ts tests/core/momo-client.test.ts`; `pnpm typecheck`; `pnpm lint`. No provider API/network/credentials in these gates. Task8 verifies real transport/contract compatibility; never fabricate a live success response.
- [ ] Review contract/verification diff; commit: `feat(payment): add isolated sepay sandbox protocol adapter`.

**Expected:** cryptographic and typed verification isolated; no success inferred from callbacks alone.

### Task 4: Durable handoff, raw IPN ACK and authorized reconciliation

**Depends:** 3. **Create:** handoff controller/helper paths above, `src/common/http/raw-response.decorator.ts`, `tests/core/sepay-gateway.http.test.ts`, `tests/core/sepay-handoff.test.ts`. **Modify:** gateway service/controller/module/DTO; common index/TransformInterceptor; HTTP harness; finance adapter only if Task1 interfaces need implementation adjustment.

**Interfaces:** SePay-only `reconcileCheckout(id,userId): Promise<GatewayCheckout>`, `resumeCheckout(id,userId): Promise<GatewayCheckout>`; handoff `issue(record,action:'INITIAL'|'RESUME'): string`, `landing(token): Promise<LandingPage>` read-only, `dispatch(token,browserOrigin): Promise<PreparedSepayForm>` atomic expected-attempt claim. Resume uses Task0 verified same-invoice rule after read-back, otherwise durable `PROVIDER_RESUME_CONTRACT_REQUIRED`. Raw-response metadata is method-specific; MoMo stays void204. GET landing has no claim/signature/provider form; no network/reconciliation on GET.

- [ ] RED local Nest HTTP: MoMo204 empty, SePay200 exact `{success:true}` without envelope, normal API envelope; failure categories map to Task0's verified IPN policy, not invented401/409/503. Pure header/DTO checks and explicitly injected internal normalized evidence/failure results prove local HTTP orchestration only; no fake provider HTTP response/server or network call. Global DTO/Trust body policy stays intact.
- [ ] RED capabilities: repeated/prefetched/scanner GET zero writes/claims/timestamps/leases/provider calls and no provider form; explicit dispatch POST commits one attempt before form, duplicate/concurrent expected-attempt POST no second form. Validate action/attempt/expiry/origin, escaping/separate CSP/no-store, fixed targets/no bare ID. Claimed crash plus lookup404 stays unresolved; explicit resume permitted only with pinned same-invoice safety, never automatic reset/new invoice. Late paid evidence wins under lock. Return alone zero Payment.
  Named anchors: `landing_get_and_prefetch_are_side_effect_free`, `explicit_post_commits_dispatch_attempt_once`, `claimed_unknown_requires_contract_safe_resume`, `sepay_ack_is_raw_200`, `browser_return_never_creates_payment`; use internal deterministic evidence, not provider network, for orchestration tests.
- [ ] Implement landing via read-only repository lookup, avoiding findCheckout lease-recovery writes; POST dispatch revalidates creator/current ACTIVE/ENDING write access inside atomic attempt claim. Test capability issued before access loss cannot dispatch. Keep first timestamps immutable and attempt CAS; matching-key replay never releases claimed form. Implement creator/current-writer reconcile/resume, MOMO422, contract-gated same-invoice capability, no reset-claim or remote create/cancel/refund. Public origin uses SEPAY_PUBLIC_BASE_URL, never Host/proxy/private API. Evidence read outside locks, terminal state rechecked; preserve Trust/MoMo policies.
- [ ] GREEN: core gateway/MoMo/manual tests plus `pnpm exec tsx --test tests/core/sepay-gateway.http.test.ts tests/core/sepay-handoff.test.ts`; `pnpm typecheck`; `pnpm lint`; `pnpm build`. Assert actual HTTP responses, not source strings.
- [ ] Review trust/HTTP/durability diff; commit: `feat(payment): integrate durable sepay handoff and verified recovery`.

**Expected:** complete backend path, safe uncertainty and separate ACK contracts; still disabled for general use pending remaining acceptance.

### Task 5: PostgreSQL overlap, rollback and provider isolation

**Depends:** 4. **Create:** `tests/integration/persistence/sepay-gateway.integration.ts`, `tests/integration/persistence/sepay-gateway-concurrency.integration.ts`. **Modify:** `gateway-test-support.ts`, migration-parity only for missing direct constraint coverage. Production defects require a narrowly documented fix in the owning file and affected regressions.

- [ ] RED two independent real managers/pools: same-key provider conflict; local invoice/remote ID collision rules; one expected dispatch attempt; held checkout lock visibly blocks settlement; concurrent internally verified IPN-stage/reconciliation-stage evidence creates one Payment/link/authorized notification; cross-intent settlement ID rejected. These tests exercise the shared settlement boundary, not live IPN/API verification.
- [ ] RED failure after Payment insertion, checkout update and Notification insertion → zero committed money/link/notice; retry same verified event succeeds once. Lost handoff/restart same immutable invoice, delayed contradiction cannot change terminal Payment, MoMo numeric IDs and 31-day edge still guarded.
  Named anchors: `concurrent_ipn_and_reconcile_evidence_settle_once`, `each_settlement_write_rolls_back`, `cross_intent_transaction_id_is_rejected`; query counts1/1/1 after success,0/0/0 after rollback, downstream new Allocation/Deposit application/Receipt0/0/0.
- [ ] Use real Postgres managers/transactions with explicitly labeled internal normalized evidence and injected internal failures; all external provider networking is disabled/fails the test if attempted. No merchant credentials, tunnel, device or actual SePay APIs/IPNs. Use pg blocking/locks and deterministic barriers; no arbitrary sleeps as race proof. A deferred internal evidence resolver can prove no transaction is held while orchestration awaits evidence; actual transport is Task8.
- [ ] GREEN serial reset files: `pnpm exec tsx --test --test-concurrency=1 tests/integration/persistence/sepay-gateway.integration.ts tests/integration/persistence/sepay-gateway-concurrency.integration.ts tests/integration/persistence/payment-gateway.integration.ts tests/integration/persistence/payment-gateway-concurrency.integration.ts`; migration parity; conformance; `pnpm test`, typecheck/lint/build. Zero required DB skips/cancellations; public29.
- [ ] Review money/concurrency evidence; commit: `test(payment): prove sepay settlement and handoff concurrency`.

**Expected:** deterministic provider-independent PostgreSQL evidence, zero required skips, no claim of provider verification/live IPN acceptance. Missing Sandbox prerequisites never block or skip this task.

### Task 6: Android method selection and provider-scoped recovery

**Depends:** 5. **Create:** `app/src/main/java/com/trooi/app/features/shared/PaymentProvider.kt`, `app/src/androidTestBackendDebug/java/com/trooi/app/features/PaymentProviderSmokeTest.kt`. **Modify:** `app/build.gradle.kts`, `V1PaymentGateway.kt`, `CheckoutFlow.kt`, `RentalViewModel.kt`, `RentalWorkspace.kt`, `TenantScreens.kt`, `core/auth/SessionRestore.kt`, `SessionHintsStore.kt`, `app/src/main/AndroidManifest.xml`, root return consumer only as required; existing CheckoutFlowTest, CheckoutTransportTest, SessionRestoreTest, SessionHintsPersistenceTest and alignment tests.

**Interfaces:** `PaymentProvider.MOMO|SEPAY`; `create(tenancyId,amount,key,provider=MOMO)`, `reconcile(id)`, `resume(id)`; default MOMO hints. `rememberCheckoutBeforePost` includes provider; no silent key reuse/hint loss. `launchableHttpsPayUrl(provider,url,pinnedPaymentPublicOrigin)` uses independent public origin, not API origin. `BuildConfig.PAYMENT_PUBLIC_ORIGIN` comes from `trooiPaymentPublicOrigin`/`TROOI_PAYMENT_PUBLIC_ORIGIN`. Return uses recognized provider route/local hint only.

- [ ] RED units: old hint/provider omission→MOMO, unknown provider fail closed; double-tap/restart same provider/key; provider switch new explicit intent/key but unresolved prior intent protected; mismatch response rejected; forged SePay/MoMo return status/ID ignored; expired token requires same-key renewal or reconcile; account/context generation prevents late callbacks.
  Named anchors: `oldPendingHintDefaultsToMomo`, `unresolvedProviderSwitchPreservesRecovery`, `sepayReturnCannotConfirmPayment`, `responseProviderMismatchCannotLaunch`; assert unchanged key for same provider and zero launch/paid state from forged return.
- [ ] Add explicit “MoMo” and “SePay Sandbox” selection in existing payment panel, preserving redesigned layout/manual/Claim separation. Persist only nonsecret provider/key/IDs before POST. Browser bridge opens external ACTION_VIEW; no WebView SDK or provider credentials. Only matching local hint determines refresh/reconcile; no automatic retry of mutation on return.
- [ ] Add public-origin config: test private API A=`http://10.0.2.2:3000/api/v1` with separate HTTPS B, valid exact landing path accepted only at pinned B. Missing/wrong B rejected, payUrl cannot supply trusted origin, Google bearer never enters browser. Preserve MoMo URLs/return. Show explicit reconcile/resume actions and blocked reason while retaining hint; no blind retry/claim reset.
- [ ] GREEN local: `.\gradlew.bat :app:testDebugUnitTest --rerun --no-daemon`; `.\gradlew.bat :app:assembleBackendDebug :app:lintDebug --no-daemon`; confirm variant inventory, no nonexistent task. Provider/browser/device execution is Task8, not a prerequisite for these local gates.
- [ ] Review Android transport/state/visible copy; commit: `feat(android): select optional providers and recover checkout safely`.

**Expected:** old MoMo path preserved, explicit provider selection and safe recoverable Sandbox flow; no auto-mark-paid UI.

### Task 7: API parity, authority amendment and runtime/E2E coverage

**Depends:** 6. **Create:** `tests/e2e/flows/sepay-checkout.yaml`, `tests/e2e/cases/sepay-checkout.yaml`, `tests/e2e/sepay-sandbox-runtime.ts`, `tests/e2e/maestro/sepay-checkout.yaml`, `docs/testing/sepay-sandbox-runbook.md`. **Modify:** regenerate `docs/api/openapi.json`; `src/openapi.ts` only if generation requires registration; `tests/verification/openapi-client-contract.test.ts`, `tests/e2e/flow-catalog.yaml`, coverage validator only if needed for new ID `GW-02`; existing runtime/support tests for new constructors; Android BackendOpenApiAlignmentTest/BackendRuntimeContractTest. Authority paths: PRODUCT/DESIGN/HTML/.impeccable/checklist, payment backlog, contexts integration-contracts/end-to-end-flows, original V1 spec/plan, existing device/evidence docs.

- [ ] RED contract assertions for optional/default provider, SEPAY enum, restricted reconcile, separate200/204 raw ACK, no credential/evidence request fields; coverage includes GW-02 happy/recovery/error cases without weakening GW-01/MoMo or Trust coverage.
  Case IDs: `GW-02-H01` real Sandbox success, `GW-02-E01` rejected unverified evidence, `GW-02-R01` response-loss/reconciliation. Each references `GW-02`; existing `GW-01` cases and coverage assertions remain.
- [ ] Regenerate with `pnpm openapi:generate`, preserve unrelated contracts. Register runtime scenario proving persisted MoMo compatibility plus SePay scenarios. **Live** `sepay-sandbox-runtime.ts` uses actual merchant API/IPN; no stubbed create/payment or fake Google accepted by production. It takes already authorized checkout IDs/local credentials via env and never creates a test auth bypass. Missing env/account/tunnel/auth is a failing prerequisite or explicit UNVERIFIED.
- [ ] Amend authority with dated approval decision: SEPAY optional Sandbox joins MOMO, specific dual-adapter scope supersedes general FUTURE-only wording; SePay verified API recovery is explicit exception, mandatory gateway still FUTURE. Preserve `tenant-momo`, old failure receipts and MoMo UAT blocker. Device/evidence status remains unexecuted until Task8.
- [ ] GREEN automated: OpenAPI contract tests, `pnpm e2e:coverage`, `pnpm exec tsx tests/e2e/v1-integration-runtime.ts` with guarded disposable DB, core provider regressions and Android alignment units. Record offline harness status honestly. Self-review documentation contradictions/secret exposure and exact file diff.
- [ ] Review; commit: `test(v1): align dual-provider contracts and sandbox scenarios`.

**Expected:** executable acceptance instructions and explicit approved authority extension, not a documentation-only PASS.

### Task 8: Execute real SePay Sandbox and Android acceptance

**Depends:** 7. **Modify:** runbook with redacted per-scenario receipts; create `docs/testing/sepay-sandbox-evidence-20261007.md`. Screenshots/provider responses/logs outside repo. Config stays local. No production payment.

- [ ] Own **all actual** Sandbox API/form/IPN probes and execution: first check Task0 contract compatibility, failure status/body/redelivery rules, stable IDs/lookup and same-invoice replay safety including late paid. If contradictory/unconfirmed, stop affected scenario, revise contract/spec/plan and keep channel disabled. No invented failure mapping or provider response.
- [ ] Verify device/serial/artifact/real principal, Sandbox credentials and public HTTPS B. Provision dedicated trooi_sandbox; confirm private API A and public B reach the same deployed backend/dataset, Android pinned B equals SEPAY_PUBLIC_BASE_URL, provider C stays fixed. Do not reuse operational trooi_dev or reset trooi_test. Record nonsecret fingerprints/SHA.
- [ ] Execute `.\gradlew.bat :app:connectedBackendDebugAndroidTest -PtrooiInstrumentationBuildType=backendDebug --no-daemon`; `maestro test tests/e2e/maestro/sepay-checkout.yaml` where executable. Provider/browser selectors may require manual interaction; save evidence, never fake them. Explicitly distinguish payment test results from all-suite map/key skips.
- [ ] Execute genuine flow: repeated landing GET/prefetch leaves DB unchanged; explicit dispatch POST claims then provider form; no Payment before verified evidence. Close browser after claim before provider submit, then explicit safe same-invoice resume; test accepted-but-lost POST and late-success race, no second order/charge. Verify return before/after IPN, redelivery/restart/reconcile and failure policy. Run actual sepay-sandbox-runtime script; no substituted provider server.
- [ ] Compare provider order/transaction/invoice/amount/currency/method to local committed rows; one Payment/link/authorized notice, zero new Allocation/Deposit application/Receipt. Run MoMo automated regressions unchanged; retain its externally blocked live signature/UAT status. No SePay result stands in for MoMo live success.
- [ ] Fix only observed defects via minimal reviewed change, rerun affected gates and rebuild/reinstall if source changed. Mark each executed scenario PASS/FAIL; absent execution UNVERIFIED. Commit only runbook/evidence after review: `docs(test): record actual sepay sandbox acceptance`.

**Expected:** independently verifiable real Sandbox evidence. Secret/account/HTTPS/device/Google absence blocks this task; missing Maps key blocks its own V1 map acceptance, not permission to fake either gate.

### Task 9: Final committed-HEAD verification and evidence

**Depends:** Tasks0–7 complete and Task8 execution receipt **or explicit per-gate external deferral decision**. Code/contract/finance defects are not eligible deferrals. **Modify:** evidence/runbook/checklist only for proven rows; append superseding historic evidence reference. Exact verification receipts outside repo.

- [ ] Review baseline `48d6420`..target diff for unrelated changes/lost redesign/MoMo HMAC changes/raw-coordinate regressions/secrets/capability logging. Verify original source compatibility, old failures still visible, conditional SQL guards and sandbox isolation. Address real defects with narrow reviewed commits and affected reruns.
- [ ] Commit evidence docs with an external append-only receipt path; record implementation/artifact SHA, config/principal/test data scope and explicit provider statuses. No recursive evidence-SHA edits after gates. No unsupported checklist ticks.
- [ ] On committed HEAD record SHA/clean status, then typecheck/lint/build/conformance/fullbackend/migration, serial both-provider persistence/concurrency, OpenAPI, offline runtime/coverage, full Android debug units `--rerun`, backendDebug assemble/lint. Provider/device/connected/Maestro evidence is consumed from Task8; if artifact changed, reopen the affected Task8 runs. All required skip/cancellation results stay visible, not silently inherited or marked PASS.
- [ ] Confirm Task8 receipt applies to final source/config/artifact; source/config changes reopen affected Task8 actual runs, which remain owned there. Missing device/provider evidence stays UNVERIFIED. Confirm MoMo automated regressions/no bypass, diff/cached checks/clean status and external exact-HEAD receipt.
- [ ] Report READY_TO_MERGE separately from V1_ACCEPTANCE_COMPLETE, plus MOMO_REGRESSION/MOMO_UAT/SEPAY_SANDBOX/device results, MERGE_BLOCKERS and APPROVED_EXTERNAL_BLOCKERS. Required deterministic failures, unsafe recovery and unknown enabled contracts block merge. An external deferral needs explicit user approval identifying exact gate/reason/impact/disablement; design approval or MoMo substitution is not blanket permission. Unproved SePay stays disabled. V1_ACCEPTANCE_COMPLETE remains NO for missing required external scenarios even if merge approved; never change UNVERIFIED to PASS. No push/merge included.

**Commit boundary:** `docs(v1): reconcile dual-provider acceptance evidence`; any defect fixes receive their own minimal commits before final gates.

## Plan self-review and approval

Coverage: spec1/2/10→Tasks0/7/9; provider/API/compatibility→1/2/4/6/7; migration→1/5; SePay contract/verification/recovery→0/3/4/5/8; Android/config→3/4/6/8; acceptance/exact HEAD→5/7/8/9. Every task defines a reviewable result, required evidence and commit boundary; provider-specific uncertainty never silently inherits MoMo semantics.

Deliberate limits: one unresolved local intent is protected; SePay never automatically resubmits a claimed form. Explicit same-invoice resume requires pinned provider replay safety. GET/POST boundary, origin separation, ID roles, fingerprint-before-config and deterministic Task5 are mandatory. Task8 owns live evidence; merge exceptions require exact external deferral approval while full acceptance stays truthful. Contract clarification changes spec/plan before dependent code, never verification bypass.

This plan is written at user request alongside the spec. Neither artifact is approved, no implementation method is activated, no task is completed, and no Sandbox/device evidence is claimed. Review both artifacts and approve their scope/architecture before implementation; preserve the previously chosen task/review execution method if approved.
