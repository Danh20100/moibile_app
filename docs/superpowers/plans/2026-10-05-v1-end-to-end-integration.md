# TrọƠi V1 End-to-end Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Đưa integration/v1-current từ baseline hiện tại đến READY_TO_MERGE bằng optional MoMo, an toàn payment/report, context/session restore, native Map và evidence đầy đủ.

**Architecture:** Giữ NestJS modules, transaction/repository ports và Compose Room Ledger redesign. Harden payment trong worktree riêng rồi port backend có chọn lọc; Android sở hữu session/context/routes, backend sở hữu authorization và actual-money records. Đây là một integration plan với các work package có gate riêng, không tạo thêm subsystem hoặc thay approved architecture.

**Tech Stack:** Node theo package.json, TypeScript/NestJS/Kysely/PostgreSQL/PostGIS, Android Compose/Hilt/Credential Manager, Google Maps SDK native MapView, MoMo captureWallet một bước.

**Spec:** docs/temps/v1-end-to-end-integration-spec.md — user APPROVED trong hội thoại ngày 2026-10-05; Task 1 cập nhật approval status trong file; approval không thay runtime evidence. Đọc cùng docs/temps/v1-end-to-end-integration-prompt.md. Spec và các scope decisions mới thắng prompt cũ khi mâu thuẫn.

## Global Constraints

- Canonical v3.7 → ERD → frozen public schema là authority domain; public catalog giữ 29 tables.
- MoMo là optional current V1 capability, không phải dependency bắt buộc của V1.
- Billing/Charge != Payment != Payment Claim != Deposit != Receipt != GatewayCheckout.
- Session restore và native Map là acceptance V1; authenticated Trust submission là V1, moderation/listing reports vẫn gated.
- Google ID token chỉ trong memory; reacquire credential → verified /me → non-secret user-scoped context hints → capability validation → route.
- Một bước: requestType=captureWallet, autoCapture=true immutable; chỉ verified payment-success IPN tạo GATEWAY/PROVIDER_VERIFIED Payment.
- Không auto allocation, fund Deposit, issue Receipt hoặc tin redirect; không bypass create-response signature khi sandbox khác docs.
- Replay cùng POST /finance/checkouts + Idempotency-Key; không endpoint retry riêng, không tự đổi provider requestId/orderId.
- Final failure không tự chuyển success; pending/non-final không bị coi failed. Result mapping theo API stage và autoCapture.
- Timeout 35s, lease 60s, Trust note 2.000 ký tự/body 8 KiB là implementation defaults, được điều chỉnh có evidence.
- Giữ minSdk 26 / compileSdk 36 / Kotlin Compose plugin 2.2.10 / Compose BOM 2025.08.00; không unsolicited toolchain upgrade.
- Public location không fallback exact operational pin; không raw lat/lng UX, textual geocoder/type/availability vẫn OPEN.
- Không source-string-only evidence, fake provider/auth, blanket cast/any, force-push hoặc merge/push main.
- Thiếu DB/device/Maps config/MoMo sandbox/IPN evidence → UNVERIFIED và READY_TO_MERGE: NO.

## Review Focus

Năm failure modes bổ sung vào tests của task sở hữu, không để riêng thành checklist vô chủ:

1. Android mất response sau POST đã được provider nhận: giữ key, replay tìm cùng intent/IDs, không charge thứ hai (Tasks 6, 12).
2. IPN success đến trước create response và callback trái ngược sau final failure: terminal evidence không bị overwritten, không tạo Payment trái contract (Tasks 7, 8).
3. User switch account/context hoặc mất quyền trong lúc request đang chạy: late response không đưa dữ liệu account/context cũ trở lại (Tasks 10, 11).
4. Listing unpublish đồng thời với report; client lấy private location làm fallback: transaction/report và public projection vẫn bảo vệ trust boundary (Tasks 15, 17).
5. Notification source bị xóa/mất quyền, return URI do app khác giả mạo: Back giữ caller hợp lệ, URI chỉ trigger authorized read (Tasks 12, 14).

---

## Baseline, execution rules và file ownership

Read-only verification khi lập plan: integration HEAD 340fddb6691725e03d214cacada2a352ba5ca1fe; payment audit worktree HEAD 8d5da11d808ec463dfd63ed060d1601d50b3a577. Current branch integration/v1-current upstream origin/frontend/v1-app-ui-redesign. Local work: staged docs/designs/v1/app-pov-checklist.md; untracked prompt/spec. Plan này là file mới; chưa chạy implementation gates.

Execution update 2026-10-05: Task 0 complete, fresh review spec PASS / quality APPROVED; backup/worktree/install gates green. Payment baseline test remains red at the anticipated Task 3 TS2416. Task 1 stopped without commit; its partial doc edits were restored, original staged/local work preserved. CUA createBrowserTab returned Browser is not available; coordinator independently confirmed inventory apps=[]/browsers=[]. Task 1 browser gate is UNVERIFIED.

Approved execution revision 2026-10-05: user explicitly authorizes Playwright/Chromium headless for Task 1 HTML prototype verification, including localhost serving, interaction, screenshots outside repo, themes/viewports, inventory/IDs/links/overflow/console checks. Only this browser-verification mechanism changes. Architecture, original authority gates, task dependencies and commit rules remain unchanged. Headless HTML evidence never replaces real Android, Google auth, Maps native or MoMo sandbox gates in Task 22; behavior it cannot prove stays UNVERIFIED.

Dùng I = D:/Temp/TroOiIntegration-v1-current và P = D:/Temp/TroOiV1PaymentHardening trong các lệnh Set-Location. Các path Files luôn relative với worktree task đang chạy. Không chạy commands của plan trong giai đoạn review.

Các lệnh task chạy ở root worktree ghi trong header. Khi step viết tên Gradle task sau một command, chạy cùng .\gradlew.bat và --no-daemon; khi gate liệt kê nhiều command, chạy từng command và kiểm tra exit code trước command tiếp theo. Commit boundary dùng git add -- <exact Files của task>, git diff --cached rồi git commit -m "<message>"; không stage file chưa sửa hoặc file ngoài task.

Mỗi task: red test → minimal implementation → green gate → review diff → stage chỉ Files của task → commit message chỉ định. Không git add -A, không commit unrelated staged files. Với payment task, index P phải sạch trước task. Với integration task, Task 1 xử lý staged checklist đã biết; nếu xuất hiện local work mới, preserve/reconcile trước commit, không tự bundle. Task gate FAIL thì chưa commit completion; red fail phải đúng assertion, không coi missing DB/dependency/type error là red behavior proof.

Ownership map:

| Work package | Files/boundary | Downstream |
| --- | --- | --- |
| Authority + runnable environment | docs/designs/v1, contexts/backlogs, compose.persistence.yml, persistence harness | All |
| Manual + provider protocol | billing DTO/service/controller, payment-gateway/momo, transform interceptor | Durable checkout |
| Durable checkout + settlement | finance ports/Postgres adapter, gateway service, gateway migrations | Android checkout |
| Concrete context/session | model reducers, root ViewModel, repository identity, Credential Manager/hints | All privileged UI |
| Source routes/fidelity | root route resolver, nested operator/rental routes, Room Ledger, shared surfaces | Journeys |
| Map/public-private location | native MapView + public projection + operator pickers | Guest/operator journeys |
| Trust submission | audit-trust DTO/controller/service + listing lock + Android form | Safe public report |
| Evidence + final review | executable DB/device scenarios, OpenAPI, checklist, evidence record | READY_TO_MERGE |

Dependency order: 0 → 1; 0 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9. Then 9 → 10 → 11 → 12; 10 → 13 → 14; 10 → 15 → 16; 9 → 17 → 18; 10 → 19 → 20. Tasks 12/14/16/18/20 → 21 → 22 → 23. Execute serially by default; independent branches may progress without skipping consumer dependencies. Environment work can proceed while authority review completes.

### Task 0: Preserve current work and isolate payment execution

**Depends:** none. **Worktree:** I; create P only at execution.
**Files:** Read current index and untracked prompt/spec/plan; create external backup D:/Temp/TroOiV1ExecutionBackup-20261005, not a repo artifact.
**Interfaces:** Produces pinned baseline SHA, original index patch, saved untracked docs and isolated branch integration/v1-payment-hardening.

- [x] Record git rev-parse HEAD, git branch -vv, git status --porcelain=v1, git diff --cached --stat, git worktree list, git rev-parse origin/backend/payment. Stop/rebase this plan's baseline if HEAD moved; never silently replace approved input.
- [x] Create backup directory; copy prompt/spec/this plan with Copy-Item -LiteralPath. Write git diff --cached --binary and git diff --binary as UTF-8 without BOM using System.IO.File.WriteAllText. Record Get-FileHash of all copied files and patches. No stash/reset required.
- [x] Read superpowers:using-git-worktrees; verify P does not already contain unrelated work. Run git worktree add -b integration/v1-payment-hardening D:/Temp/TroOiV1PaymentHardening 8d5da11d808ec463dfd63ed060d1601d50b3a577.
- [x] Check git -C P status --short is empty and I has exactly original local work plus plan. Run pnpm install --frozen-lockfile in P at execution; no lockfile drift.

**Expected:** I/index intact, payment isolated, no branch switch in dirty I.
**Commit boundary:** none; backup/worktree setup does not change tracked product files.

### Task 1: Reconcile V1 authority without weakening Canonical

**Depends:** 0. **Worktree:** I.
**Files — modify:** docs/designs/v1/PRODUCT.md; docs/designs/v1/DESIGN.md; docs/designs/v1/TroOi_Product_Universe_Interactive.html; docs/designs/v1/.impeccable/design.json; docs/designs/v1/app-pov-checklist.md; docs/contexts/integration-contracts.md; docs/contexts/end-to-end-flows.md; docs/backlogs/v1/payment.md; docs/backlogs/v1/search-map.md; docs/backlogs/v1/identity-access.md; docs/backlogs/v1/trust-report.md.
**Files — add to version control:** docs/temps/v1-end-to-end-integration-prompt.md; docs/temps/v1-end-to-end-integration-spec.md; docs/superpowers/plans/2026-10-05-v1-end-to-end-integration.md.
**Interfaces:** Same stable screen IDs, tenant-momo current V1; shared-session/map/safe Trust submission current V1; Claim/Review/Inquiry Activity retain explicit gates.

- [x] Read Canonical/ERD and listed authority; preserve existing staged +8-line promotion. Change scope text/inventory relations and totals consistently; retain future-payment-gateway as provider/platform expansion outside optional MoMo.
- [x] Record manual vs gateway, signed-IPN-only Payment, session reacquire, native map, Listing-only report activation and tenancy-scoped Notice. Do not claim delivery or tick runtime DoD.
- [x] Open HTML in browser, exercise tenant-momo/shared-session/guest-map/shared-trust-report/notice in both themes; verify IDs/links/counts and no new overflow. Keep visual structure/design tokens. Update .impeccable metadata only where scope data is duplicated.
- [x] Approved headless fallback: use Playwright/Chromium in an external disposable harness under D:/Temp/TroOiV1ExecutionBackup-20261005/browser-task1, not a product dependency. Localhost serving is allowed if file:// restricts interaction. Load current HTML and git-baseline HTML; exercise tenant-momo/shared-session/guest-map/shared-trust-report/notice in light/dark at 1440x1000 and 390x844, run existing in-page 85-screen verifier, check inventory counts, stable IDs/navigation/relation targets, broken links, JS console errors and document width <= viewport. Capture before/after screenshots and inspect them; retain engine/version/commands/results/artifact paths in task report. Existing baseline overflow must be identified separately; no new overflow permitted. Headless-unprovable behavior stays UNVERIFIED; renderer unavailable or failed visual assertion remains a blocker, never replaced by source-string checks or Task 22 exemptions.
- [x] Run pnpm test:conformance:database-v1 and git diff --check; inspect no Canonical/ERD/frozen SQL diff. Expected 57 baseline cases plus any intentional authority assertions green, no domain weakening.

**Expected:** V1 inventory/HTML/checklist thống nhất approved scope, stable IDs/links hợp lệ, Canonical invariants và user's staged promotion được giữ.
**Commit boundary:** docs(v1): align approved optional momo and integration scope. Stage only listed docs after inspecting cached diff; this intentionally includes user's staged promotion. No implementation in this commit.

### Task 2: Make disposable PostgreSQL gates runnable

**Depends:** 0. **Worktree:** P; changes later ported by Task 9.
**Files — modify:** compose.persistence.yml; tests/integration/persistence/support/postgres-test-harness.ts; tests/integration/persistence/migration-parity.integration.ts.
**Files — create:** tests/integration/persistence/gateway-test-support.ts.
**Interfaces:** resetPublicSchema(databaseUrl): Promise<void> retains existing name; extends disposable reset to gateway + public. gatewayFixture(url) supplies migrated Postgres repositories/manager, ACTIVE tenancy, authorized creator and notification recipient.

- [x] Correct missing .sql mount to existing ./database/dev/01-create-test-db.sh and container target .sh; set POSTGRES_TEST_DB=trooi_test. Keep current DB image/volume; do not remove existing Docker volume.
- [x] In disposable test reset, reject database names other than trooi_test before destructive SQL, DROP gateway before public, then recreate public/migrate. Existing rental fixtures keep working; never reset dev/shared DB.
- [x] Bootstrap existing volume explicitly because init scripts only run once: pnpm db:dev:up; wait docker compose -f compose.persistence.yml exec -T postgres pg_isready -U trooi -d trooi_dev; set DATABASE_URL to local trooi_dev then pnpm exec tsx scripts/database/bootstrap-test-db.ts.
- [x] Set TEST_DATABASE_URL to local trooi_test, migrate disposable DB, run pnpm test:persistence:migration twice. Assertion: public table count 29, gateway schema freshly migrated on repeat, no old FK/residue. Add same proof to migration test.
- [x] Create gatewayFixture from rentalFixture patterns; use amounts >=1000 instead of financeFixture's 100.00 payment. Close all pools in finally. Log only database name/exit, not credential URLs.

~~~powershell
$env:DATABASE_URL = 'postgresql://trooi:trooi_local@localhost:5432/trooi_dev'
pnpm exec tsx scripts/database/bootstrap-test-db.ts
$env:TEST_DATABASE_URL = 'postgresql://trooi:trooi_local@localhost:5432/trooi_test'
pnpm test:persistence:migration
pnpm test:persistence:migration
~~~

**Expected:** real PostGIS DB available and repeated migration parity passes; Docker unavailable remains external blocker, not skip.
**Commit boundary:** fix(test): bootstrap isolated postgres gateway fixtures.

### Task 3: Correct interceptor contract and IPN HTTP acknowledgement

**Depends:** 2. **Worktree:** P.
**Files — modify:** src/common/interceptors/transform.interceptor.ts; src/modules/payment-gateway/controllers/payment-gateway.controller.ts; src/modules/payment-gateway/dto/index.ts; src/modules/payment-gateway/services/payment-gateway.service.ts.
**Files — create/test:** tests/core/payment-gateway.http.test.ts; tests/core/support/payment-gateway-http-harness.ts.
**Interfaces:** handleMomoIpn(payload): Promise<void>; controller @HttpCode(204) returns void. startGatewayHttpHarness({service,authz,verifier}) returns Promise<{baseUrl:string,close:()=>Promise<void>}>; dependencies use existing service/authorization/verifier types. Harness creates real Nest HTTP pipeline with ValidationPipe/filter/interceptor and a test verifier implementing existing GOOGLE_ID_TOKEN_VERIFIER port; no production auth bypass or new test framework.

- [x] Add HTTP tests: accepted IPN status=204 and text=''; errors remain non-204; ordinary GET keeps response envelope. Assert unknown client fields reject through real ValidationPipe.
- [x] Run pnpm exec tsx --test tests/core/payment-gateway.http.test.ts; baseline may first show TS2416; fix type then verify behavioral red against old 201/body.
- [x] Align NestInterceptor generic/output union explicitly; bypass wrapping only metadata-designated raw/no-body response or HTTP 204. No any/blanket cast or magic route suffix.
- [x] Define runtime MomoIpnDto in dto/index.ts for required signed transport fields; controller uses class DTO so ValidationPipe can reject unknown fields. Stage-aware semantic validation remains Tasks 5/7, không chỉ TypeScript interface bị erase.
- [x] Remove success JSON ACK DTO from active controller/OpenAPI response; service void return. Run focused HTTP test, pnpm typecheck, pnpm build, pnpm lint.

**Expected:** no TS2416; success wire ACK exactly 204/empty, error handling unchanged.
**Commit boundary:** fix(payment): honor momo empty ipn acknowledgement.

Test anchor trong payment-gateway.http.test.ts, tên ipn_ack_is_empty_204:
~~~typescript
assert.equal(response.status, 204);
assert.equal(await response.text(), '');
~~~

### Task 4: Close manual Payment provenance and authorization bypass

**Depends:** 3. **Worktree:** P.
**Files — modify:** src/modules/billing/dto/index.ts; src/modules/billing/contracts/index.ts; src/modules/billing/controllers/billing.controller.ts; src/modules/billing/services/billing.service.ts; tests/core/finance.behavior.test.ts; tests/core/dto-boundary.validation.test.ts; tests/core/support/payment-gateway-http-harness.ts.
**Files — create/test:** tests/core/manual-payment.http.test.ts.
**Interfaces:** RecordPaymentDto excludes verification and source accepts only MANUAL_CASH/MANUAL_TRANSFER. BillingService.recordPayment(input: ManualRecordPaymentInput): Promise<Payment> derives USER_RECORDED; trusted IPN writes Payment via existing transaction repositories.

- [x] Assert HTTP spoof source=GATEWAY or verification=PROVIDER_VERIFIED →400/no insert; tenant →403 for manual confirmation; operator manual →201/USER_RECORDED. Assert service rejects runtime untrusted provenance even when TS types are bypassed by input parsing.
- [x] Restrict controller to assertOperatesTenancy, derive verification in service; retain read DTO full PaymentSource/Verification. Narrow correction manual input too so gateway provenance cannot be forged through correction path; audit call sites before changing input type.
- [x] Update behavior callers to omit verification; keep lower-level persistence fixtures capable of inserting genuine gateway records. No policy closure for Payment Claim.
- [x] Run pnpm exec tsx --test tests/core/manual-payment.http.test.ts tests/core/finance.behavior.test.ts tests/core/dto-boundary.validation.test.ts; pnpm typecheck; pnpm lint.

**Expected:** user-accessible manual/correction paths cannot claim provider evidence; manual channel remains usable without MoMo configuration.
**Commit boundary:** fix(finance): separate manual recording from gateway evidence.

Test anchor manual_gateway_provenance_is_rejected trong manual-payment.http.test.ts:
~~~typescript
assert.equal(spoofedGateway.status, 400);
assert.equal(spoofedVerification.status, 400);
assert.equal(tenantManual.status, 403);
assert.equal(insertedPayments.length, 0);
~~~

### Task 5: Verify MoMo payloads and classify result codes by stage

**Depends:** 4. **Worktree:** P.
**Files — modify:** src/modules/payment-gateway/momo/momo-client.ts; src/modules/payment-gateway/momo/momo-hmac.ts; tests/core/momo-hmac.test.ts; .env.example.
**Files — create:** src/modules/payment-gateway/momo/momo-result.ts; tests/core/momo-result.test.ts; tests/core/momo-client.test.ts; tests/core/fixtures/momo-signed-payloads.json.
**Interfaces:** classifyMomoResult(stage: 'CREATE'|'PAYMENT_IPN', resultCode: number, autoCapture: boolean): 'CREATE_ACCEPTED'|'PAYMENT_SUCCEEDED'|'PENDING'|'FINAL_FAILURE'|'RETRYABLE_NON_FINAL'|'RECONCILE'; createCaptureWallet verifies/normalizes response before returning. Unknown outcome never implies paid/failed.

- [x] Freeze independent HMAC fixtures from provider contract/manual independent calculation; retain timing-safe comparison. Test create/IPN missing/invalid signature and missing fields, mismatched partner/order/request/amount, malicious payUrl host/scheme.
- [x] Assert create 0=CREATE_ACCEPTED, IPN 0=PAYMENT_SUCCEEDED; 1000/7000/7002=PENDING; IPN 9000 true=PAYMENT_SUCCEEDED, false=PENDING; create 9000 cannot settle money; 40/41=RECONCILE; unknown code=RECONCILE.
- [x] Implement payment/create-applicable final failure allowlist: 98,99,1001,1002,1003,1004,1005,1006,1007,1017,1026,2019,4001,4002,4100; non-final 10,11,12,13,20,21,22,42,43,45,47 stay non-final. Exclude refund codes 1080/1081/1088. Verify API applicability against live provider docs at execution; changed contract requires fixture/map review, not blind reuse.
- [x] Enforce whole integer VND [1000,50000000], exact decimal conversion before Number; base64 JSON {checkoutId}; autoCapture=true explicitly. Verify HTTP status, shape, HMAC signed field set and immutable identities; HTTPS payUrl host allowlist test-payment.momo.vn for sandbox/payment.momo.vn for production, verify actual documented host before widening.
- [x] Use defaults 35s provider timeout; credentials/URLs from env, reject incomplete configuration as optional-channel unavailable. Do not disable manual flow/startup when MoMo disabled. Sandbox missing/different create signature is blocker until provider contract clarified.
- [x] Run pnpm exec tsx --test tests/core/momo-hmac.test.ts tests/core/momo-result.test.ts tests/core/momo-client.test.ts; pnpm typecheck; pnpm lint.

**Expected:** protocol/financial outcome distinction covered independently; no success-only-zero rule.
**Commit boundary:** fix(payment): verify momo protocol and outcome semantics.
**Primary references:** [result codes](https://developers.momo.vn/v3/vi/docs/payment/api/result-handling/resultcode/), [captureWallet](https://developers.momo.vn/v3/vi/docs/payment/api/wallet/onetime/). Revalidate signed-field ambiguity with provider; never bypass.

### Task 6: Persist intent before handoff and resume through POST replay

**Depends:** 5. **Worktree:** P.
**Files — modify:** src/modules/payment-gateway/contracts/index.ts; src/modules/payment-gateway/dto/index.ts; src/modules/payment-gateway/controllers/payment-gateway.controller.ts; src/modules/payment-gateway/services/payment-gateway.service.ts; src/persistence/ports/finance.repository.ts; src/infrastructure/database/repositories/finance.repository.ts; tests/core/payment-gateway.behavior.test.ts; tests/core/support/in-memory-transaction-manager.ts; tests/core/payment-gateway.http.test.ts.
**Files — migration:** inspect database/migrations/000003_gateway_checkouts.ts and sql/000003_gateway_checkouts.up.sql/.down.sql. Default safe choice: create database/migrations/000004_gateway_checkout_durability.ts plus sql/000004_gateway_checkout_durability.up.sql/.down.sql; do not rewrite 000003 unless shared deployment non-use is proven.
**Interfaces:** createCheckout(input: CreateGatewayCheckoutInput, userId: string, idempotencyKey: string): Promise<GatewayCheckout>; findCheckout(id:string,userId:string):Promise<GatewayCheckout> receives actor from verified controller principal. FinanceRepository.findGatewayCheckoutByClientKey(userId:string,key:string):Promise<GatewayCheckoutRecord|undefined>, acquireGatewayDispatchLease(id:string,owner:string,now:string,leaseUntil:string):Promise<boolean>, existing lock/find/update methods. Status union INITIATED|CREATED|UNKNOWN|FAILED|SUCCEEDED; correlation + firstDispatchAt + lease token/until + provider outcome persisted. GatewayCheckout DTO adds replayAllowed:boolean and replayBlockedReason?:string from current actor/intent eligibility; no secret/idempotency key in read DTO. Former/operator read remains authorized but replayAllowed=false unless caller owns intent and retains write access. Android consumes these exact names in Task 12.

- [x] Test commit-before-provider: provider fake queries intent during call and sees committed IDs. Insert failure →0 provider calls. Same user/key/payload →same checkout/IDs; changed tenancy/amount →409; missing/invalid header →400.
- [x] Test crash lease expiry, provider accept+timeout, local completion failure, client response loss, and concurrent same-key dispatcher. Assert no Payment and replay identical provider payload; GET never calls create. Use injected clock/lease default 60s without sleeps.
- [x] Migration adds client-key uniqueness/fingerprint, immutable snapshot incl autoCapture, outcome/terminal evidence, lease/first dispatch; replace EXPIRED in active contract and constrain result link/status. Unique provider order/request identity includes provider/partner; successful transId and resultingPaymentId uniqueness backstop later Task 7.
- [x] Handle pre-existing 000003 rows without fabrication: preserve IDs/payment links; legacy unsettled rows lacking reconstructible snapshot become replay-blocked with explicit reconcile reason; do not invent provider request payload from current config. Test upgrade with CREATED and SUCCEEDED legacy records.
- [x] Require ACTIVE/ENDING write access before new intent/replay. Insert transaction commit first, lease commit second, provider HTTP outside DB transaction, completion CAS ownership under lock. Late create completion cannot erase IPN/terminal outcome.
- [x] Replay POST resumes only INITIATED/UNKNOWN eligible intents: no active lease, no pending/reconcile/verification blocker, within 31-day first-dispatch window. CREATED/final return durable state. New order never auto-created; different user key is a different namespace, not takeover. Persist key in Android before POST later.
- [x] Run focused gateway behavior/HTTP tests, pnpm typecheck, pnpm test:persistence:migration. Migration down/up only disposable database; no production down for unresolved/paid data.

**Expected:** callback always has durable correlation before provider gets request; response loss safe to replay.
**Commit boundary:** feat(payment): persist and resume idempotent checkout intents.

Test anchor lost_response_replay_reuses_provider_identity trong payment-gateway.behavior.test.ts:
~~~typescript
assert.equal(replayed.id, original.id);
assert.equal(secondDispatch.requestId, firstDispatch.requestId);
assert.equal(secondDispatch.orderId, firstDispatch.orderId);
assert.equal(payments.size, 0);
~~~

### Task 7: Atomic verified settlement and terminal outcome rules

**Depends:** 6. **Worktree:** P.
**Files — modify:** src/modules/payment-gateway/services/payment-gateway.service.ts; src/modules/payment-gateway/dto/index.ts; src/persistence/ports/finance.repository.ts; src/infrastructure/database/repositories/finance.repository.ts; migration 000004 SQL from Task 6; tests/core/payment-gateway.behavior.test.ts; tests/core/payment-gateway.http.test.ts; tests/core/support/in-memory-transaction-manager.ts.
**Interfaces:** handleMomoIpn(payload): Promise<void>; verified DTO owns runtime validation; classifyMomoResult from Task 5; finance lock/read/insert/update in one tx.

- [x] Assert invalid signature/identity/amount/extraData leaves state unchanged; pending no Payment; 9000 one-step success produces one gateway Payment; final failure then success →409 and no Payment. Success then failure/other transId →409, original Payment intact.
- [x] Assert callback-before-create-response succeeds from INITIATED/UNKNOWN; duplicate same successful transId →204/no duplicate notification; duplicate final failure and late pending →204/no state downgrade.
- [x] Verify before mutation; lock/reread checkout, compare exact persisted identity/amount, normalize outcome by stage. Insert Payment/result link/notification atomically only for eligible success; rollback any failing insert/update/notification. No Billing/Deposit/Receipt coordinator call.
- [x] Persist terminal evidence separately from late observations; redact logs. Preserve current authorized recipient contract, avoid arbitrary firstOrNull recipient selection: notify authorized checkout creator once; no new notification policy/broadcast.
- [x] Run pnpm exec tsx --test tests/core/payment-gateway.behavior.test.ts tests/core/payment-gateway.http.test.ts tests/core/momo-result.test.ts; pnpm typecheck; pnpm lint.

**Expected:** exact one actual-money write through verified IPN and no illegal terminal reversal.
**Commit boundary:** fix(payment): atomically settle verified momo callbacks.

Test anchor final_failure_rejects_success_reversal trong payment-gateway.http.test.ts:
~~~typescript
assert.equal(lateSuccess.status, 409);
assert.equal(storedCheckout.status, 'FAILED');
assert.equal(insertedPayments.length, 0);
~~~

### Task 8: Prove checkout races in PostgreSQL

**Depends:** 7. **Worktree:** P.
**Files — create/test:** tests/integration/persistence/payment-gateway.integration.ts; tests/integration/persistence/payment-gateway-concurrency.integration.ts.
**Files — modify:** tests/integration/persistence/gateway-test-support.ts; tests/integration/persistence/migration-parity.integration.ts.
**Interfaces:** Real PostgresTransactionManager, two independent pools/managers (maxPoolSize>=2), deterministic lock/barrier helper local to tests; no test-only production locks.

- [ ] Concurrent same-key create via two managers →one durable intent, same provider IDs, one dispatcher while lease valid. Restart manager after uncertain dispatch and replay same IDs.
- [ ] Hold checkout row lock on connection A, start callback B and prove it waits; release A. Then two successful callbacks concurrently →one Payment/result link/notification; query real rows and downstream zero counts. Use barriers, not arbitrary sequential calls or sleeps as race proof.
- [ ] Force rollback after Payment insert via failing repository wrapper around real tx; assert zero committed Payment/link/notification, callback retry succeeds. Cross-intent duplicate successful transId is rejected by DB constraint.
- [ ] Test final-failure/success race: serialized winner respects terminal rule; contradictory loser cannot create/undo money. Late create CAS cannot overwrite IPN. Validate UNIQUE/CHECK/FK at SQL level, public catalog still 29.
- [ ] Run tests serially across files that reset same DB:

~~~powershell
pnpm exec tsx --test --test-concurrency=1 tests/integration/persistence/payment-gateway.integration.ts tests/integration/persistence/payment-gateway-concurrency.integration.ts
pnpm test:persistence:migration
pnpm typecheck
pnpm lint
pnpm build
pnpm test:conformance:database-v1
pnpm test
~~~

**Expected:** zero skipped/cancelled required DB cases; evidence shows overlapping PostgreSQL transactions, not in-memory-only proof.
**Commit boundary:** test(payment): prove durable checkout and callback concurrency.

### Task 9: Selectively port hardened backend into current integration

**Depends:** 1,8. **Worktree:** I; read P.
**Files — import from P:** payment-gateway contracts/index.ts, controllers/payment-gateway.controller.ts, dto/index.ts, index.ts, momo/momo-client.ts, momo/momo-hmac.ts, momo/momo-result.ts, payment-gateway.module.ts, services/payment-gateway.service.ts (all under src/modules/payment-gateway); migrations 000003 and 000004 with their up/down SQL; new/changed payment tests listed Tasks 2–8.
**Files — merge manually:** src/app.module.ts; src/openapi.ts; src/common/interceptors/transform.interceptor.ts; src/persistence/ports/finance.repository.ts; src/infrastructure/database/repositories/finance.repository.ts; src/modules/billing/dto/index.ts; src/modules/billing/contracts/index.ts; src/modules/billing/controllers/billing.controller.ts; src/modules/billing/services/billing.service.ts; .env.example; compose.persistence.yml; tests/core/support/in-memory-transaction-manager.ts; tests/core/finance.behavior.test.ts; tests/core/dto-boundary.validation.test.ts; tests/integration/persistence/support/postgres-test-harness.ts; tests/integration/persistence/migration-parity.integration.ts; tsconfig.tests.json; tests/tsconfig.json.
**Files — regenerate:** docs/api/openapi.json.
**Interfaces:** Target Nest module imports/registers gateway; OpenAPI describes header/replay/statuses, 204 empty IPN and restricted manual DTO.

- [ ] Record P final SHA, I pre-port SHA and clean indexes; inspect diff 41ca82b..payment-hardening. Import exact backend files with git restore --source=<hardened SHA> --worktree -- listed paths only. Do not import Android files, old OpenAPI snapshot or handoff artifacts.
- [ ] Merge shared modules/ports/types/tests into newer integration source, preserving current Google/runtime and repository interfaces. No whole-branch merge/cherry-pick that overwrites unrelated baseline.
- [ ] Regenerate pnpm openapi:generate; inspect header contract and unchanged unrelated paths. Source OpenAPI script owns snapshot, not manual JSON edits.
- [ ] Run all Task 8 commands in I plus pnpm exec tsx --test tests/verification/openapi-client-contract.test.ts. Review git diff I-before..worktree for only intended backend changes.
- [ ] Confirm RentalViewModel.kt, RentalWorkspace.kt, TenantScreens.kt unchanged by port; no unresolved markers; preserve staged/user docs already handled in Task 1.

**Expected:** current integration contains hardened backend with redesigned Android intact.
**Commit boundary:** feat(v1): integrate hardened optional momo backend. Do not merge/push main or use upstream-default push.

### Task 10: Concrete context reducer and scoped workspace entry

**Depends:** 9. **Worktree:** I.
**Files — create:** app/src/main/java/com/trooi/app/core/model/ContextSelection.kt; app/src/test/java/com/trooi/app/core/model/ContextSelectionTest.kt.
**Files — modify:** app/src/main/java/com/trooi/app/core/model/Models.kt; app/src/main/java/com/trooi/app/core/model/FrontendReadSnapshot.kt; app/src/main/java/com/trooi/app/ui/TroOiViewModel.kt; app/src/main/java/com/trooi/app/ui/TroOiApp.kt; app/src/main/java/com/trooi/app/features/shared/ContextSwitcherScreen.kt; app/src/main/java/com/trooi/app/features/tenant/TenantPovScreens.kt; app/src/main/java/com/trooi/app/features/landlord/LandlordScreens.kt; app/src/main/java/com/trooi/app/features/organization/OperatorViewModel.kt; app/src/main/java/com/trooi/app/features/tenancy/RentalViewModel.kt.
**Interfaces:** SelectedContext = Discovery | Tenant(tenancyId:String) | Operations(organizationId:String); reconcileContext(selection: SelectedContext?, access: AccessCapabilities): ContextResolution; ContextResolution contains selection + needsPicker. Root selectContext(context), selectedContext in TroOiUiState; operator begin(access, organizationId), rental start(roomId, linkedTenancyId).

- [ ] Assertions: valid remembered ID retained; removed ID →picker when multiple, unique remaining auto-select, zero→Discovery; two tenancy/org IDs never firstOrNull-select; former history doesn't gain writes.
- [ ] Add pure reducer; activeContext category derives selection for existing navigation. Switcher lists concrete IDs with labels from authorized source projections; missing label uses safe neutral label, not fabricated relationship.
- [ ] Scope Dashboard/Finance/read projections and nested entry to selected IDs; clear nested state on context change, not all memberships. Tenant tabs receive selectedTenancyId, operator receives selectedOrganizationId.
- [ ] Refresh /me reconciles selection/page/resources before render; increment context/session generation, discard old read/mutation callbacks. Test old request from A after switch B cannot populate B; removed-capability routes fall back.
- [ ] Run .\gradlew.bat :app:testDebugUnitTest --tests com.trooi.app.core.model.ContextSelectionTest --rerun --no-daemon; :app:assembleBackendDebug. Preserve existing contract tests, update only expectations superseded by approved context model.

**Expected:** selected IDs drive projections/commands; access refresh cannot strand user in stale context.
**Commit boundary:** feat(android): select and reconcile concrete v1 contexts.

Test anchor multiple_contexts_require_picker trong ContextSelectionTest.kt:
~~~kotlin
assertTrue(resolution.needsPicker)
assertEquals(SelectedContext.Discovery, resolution.selection)
assertEquals(0, readsFromArbitraryFirstTenancy)
~~~

### Task 11: Restore session through reacquired Google credential

**Depends:** 10. **Worktree:** I.
**Files — create:** app/src/main/java/com/trooi/app/core/auth/SessionRestore.kt; app/src/main/java/com/trooi/app/core/auth/SessionHintsStore.kt; app/src/test/java/com/trooi/app/core/auth/SessionRestoreTest.kt; app/src/androidTestBackendDebug/java/com/trooi/app/features/SessionHintsPersistenceTest.kt.
**Files — modify:** app/build.gradle.kts; app/src/main/java/com/trooi/app/core/auth/GoogleCredentialAuth.kt; app/src/main/java/com/trooi/app/core/data/TroOiRepository.kt; app/src/main/java/com/trooi/app/core/data/BackendTroOiRepository.kt; app/src/main/java/com/trooi/app/core/network/AuthTokenProvider.kt; app/src/main/java/com/trooi/app/ui/TroOiViewModel.kt; app/src/main/java/com/trooi/app/ui/TroOiApp.kt; app/src/main/java/com/trooi/app/MainActivity.kt; app/src/debug/java/com/trooi/app/core/data/TroOiRepositoryImpl.kt; app/src/testDebug/java/com/trooi/app/core/model/DebugProjectionTest.kt if constructors require update.
**Interfaces:** UserSession gains backend userId:String; SessionHints(userId, restoreEnabled, selectedContext, pendingCheckouts:List<PendingCheckoutHint>); PendingCheckoutHint(tenancyId:String,amount:String,idempotencyKey:String,checkoutId:String?) stores only immutable non-secret replay inputs. Store read/write/clear uses SharedPreferences. GoogleCredentialAuth.reacquireIdToken(context): Result<String>, clearCredentialState(context): Result<Unit>; existing getIdToken explicit flow retained. Restore pipeline outputs verified UserSession/context only after /me.

- [ ] Build pure restore coordinator with credential/repository/store lambdas for tests, not a new auth subsystem. Cases: credential →auth/google →/me →matching hints →valid context, wrong user hints ignored, offline/401/cancel fail closed, no credential→explicit login/Discovery.
- [ ] BackendTroOiRepository maps /me.userId into UserSession. Persist only non-secret hints after verified identity; never token, serialized credential, cached access flags or payUrl. Demo UserSession uses stable demo ID only in isolated debug source set.
- [ ] MainActivity/Compose lifecycle triggers bootstrap once with Activity context; returning credential uses GetGoogleIdOption authorized accounts/auto select, fallback explicit button. Session-loading/retry screen gates privileged rendering.
- [ ] One guarded reacquire on expired auth, retry reads only; checkout mutations replay only by same persisted key. Logout/account change clears token+hints and Credential Manager state, increments generation/cancels work; delayed auth cannot resurrect logout.
- [ ] Unit tests verify sequence, account switch, logout, expired token, offline, cancellation, late callbacks; instrumentation writes hints, recreates reader, checks only permitted values and clearing.
- [ ] Configure android.testBuildType = providers.gradleProperty("trooiInstrumentationBuildType").orElse("debug").get() in app/build.gradle.kts, preserving demo debug default. All backendDebug instrumentation commands pass -PtrooiInstrumentationBuildType=backendDebug so androidTestBackendDebug is actually compiled/run.
- [ ] Run .\gradlew.bat :app:testDebugUnitTest --tests com.trooi.app.core.auth.SessionRestoreTest --rerun --no-daemon; :app:assembleBackendDebug; .\gradlew.bat :app:connectedBackendDebugAndroidTest -PtrooiInstrumentationBuildType=backendDebug -Pandroid.testInstrumentationRunnerArguments.class=com.trooi.app.features.SessionHintsPersistenceTest --no-daemon when device available. Real Google process restart evidence owned Task 22.

**Expected:** valid user/context restores after process death with reacquired credential; no persisted long-lived token.
**Commit boundary:** feat(auth): restore verified v1 session and context.

Test anchor restore_requires_verified_me_before_hints trong SessionRestoreTest.kt:
~~~kotlin
assertEquals(listOf("credential", "auth/google", "me", "hints", "context"), calls)
assertFalse(persistedValues.any { it.contains(idToken) })
assertFalse(stateAfterOfflineFailure.isAuthenticated)
~~~

### Task 12: Android checkout key, handoff and untrusted return routing

**Depends:** 11,9. **Worktree:** I.
**Files — create:** app/src/main/java/com/trooi/app/features/shared/V1PaymentGateway.kt; app/src/main/java/com/trooi/app/features/tenancy/CheckoutFlow.kt; app/src/test/java/com/trooi/app/features/tenancy/CheckoutFlowTest.kt; app/src/test/java/com/trooi/app/core/network/CheckoutTransportTest.kt.
**Files — modify:** app/src/main/java/com/trooi/app/core/network/BackendClient.kt; app/src/main/java/com/trooi/app/core/network/dto/BackendDtos.kt; app/src/main/java/com/trooi/app/features/shared/V1RentalGateway.kt; app/src/main/java/com/trooi/app/features/tenancy/RentalViewModel.kt; app/src/main/java/com/trooi/app/features/tenancy/RentalWorkspace.kt; app/src/main/java/com/trooi/app/features/tenant/TenantScreens.kt; app/src/main/java/com/trooi/app/ui/TroOiViewModel.kt; app/src/main/java/com/trooi/app/ui/TroOiApp.kt; app/src/main/java/com/trooi/app/MainActivity.kt; app/src/main/java/com/trooi/app/core/auth/SessionHintsStore.kt; app/src/main/AndroidManifest.xml.
**Interfaces:** BackendClient.postJson(path,json,authenticated=false,headers:Map<String,String>=emptyMap()) permits only caller-supplied Idempotency-Key, never arbitrary Authorization override. V1PaymentGateway.create(tenancyId,amount,key): GatewayCheckout; get(id): GatewayCheckout. Android GatewayCheckout contains id/tenancyId/amount/referenceCode/provider/status/createdAt/replayAllowed plus nullable payUrl/resultingPaymentId/replayBlockedReason; keep exact JSON names from Task 6/regenerated OpenAPI. CheckoutFlow stores immutable amount/tenancy/key before call, checkout ID after response.

- [ ] Transport tests prove header sent, unrelated requests unchanged, POST not silently retried. Flow tests: double tap→same key, lost response→same POST/key, pending no Payment, provider disabled→manual flow available.
- [ ] Port behavior from payment Android, rebuilding against redesigned rental/tenant files. Launch only verified signed HTTPS payUrl; no direct unverified deeplink. Show status/replay eligibility/error honestly; do not show confirmed Payment until authorized backend read.
- [ ] Update V1RentalGateway.recordPayment to omit verification now derived by backend; operator manual actions remain available, tenant manual-confirm controls disabled. CheckoutTransportTest also asserts manual body has source/amount/tenancyId/confirmedAt and no verification field.
- [ ] Register trooi://payment/momo return filter preserving current permissions/predictive Back. MainActivity handles cold/warm intents; URI params never set Payment status or select user. Restore auth then read remembered user-scoped checkout; unknown URI/order without local correlation shows safe recovery, no write.
- [ ] Test forged return with resultCode=0 can't mark paid; return before/after IPN; logout/account switch clears local pending hints but durable backend remains. CheckoutFlow is pure testable coordinator, no new provider framework.
- [ ] Run .\gradlew.bat :app:testDebugUnitTest --tests com.trooi.app.features.tenancy.CheckoutFlowTest --tests com.trooi.app.core.network.CheckoutTransportTest --rerun --no-daemon; :app:assembleBackendDebug; :app:lintDebug.

**Expected:** handoff/restart/replay uses same durable intent; return cannot forge money.
**Commit boundary:** feat(android): wire durable optional momo checkout flow.

### Task 13: Legal Room operations in UI and shared command guard

**Depends:** 10. **Worktree:** I.
**Files — create:** app/src/main/java/com/trooi/app/features/organization/RoomOperations.kt; app/src/test/java/com/trooi/app/features/organization/RoomOperationsTest.kt.
**Files — modify:** app/src/main/java/com/trooi/app/features/organization/OperatorWorkspace.kt; app/src/main/java/com/trooi/app/features/organization/OperatorViewModel.kt; app/src/main/java/com/trooi/app/features/shared/V1ContractGateway.kt; app/src/test/java/com/trooi/app/features/V1CompletionContractTest.kt.
**Interfaces:** legalRoomTargets(state:String): Set<String>; operator state mutation rejects target not in set before transport; backend remains authoritative.

- [ ] Exact matrix assertions: VACANT={MAINTENANCE,INACTIVE}; MAINTENANCE={VACANT,INACTIVE}; INACTIVE={VACANT}; OCCUPIED={}; unknown={}. Rejected mutation records zero gateway calls.
- [ ] Replace all-state dropdown with legal targets; occupied room points to confirmed tenancy checkout; conflict/403 refreshes source without optimistic illegal state.
- [ ] Run .\gradlew.bat :app:testDebugUnitTest --tests com.trooi.app.features.organization.RoomOperationsTest --rerun --no-daemon; pnpm exec tsx --test tests/core/room.behavior.test.ts tests/core/rental-lifecycle.behavior.test.ts; :app:assembleBackendDebug.

**Expected:** five legal manual transitions only; occupied→vacant remains backend checkout cause.
**Commit boundary:** fix(android): enforce room operational transition matrix.

### Task 14: Exact source routes, caller Back and Room Ledger affordances

**Depends:** 10,13. **Worktree:** I.
**Files — create:** app/src/main/java/com/trooi/app/core/model/SourceNavigation.kt; app/src/test/java/com/trooi/app/core/model/SourceNavigationTest.kt; app/src/androidTestBackendDebug/java/com/trooi/app/features/SourceNavigationSmokeTest.kt.
**Files — modify:** app/src/main/java/com/trooi/app/core/model/Models.kt; app/src/main/java/com/trooi/app/ui/TroOiViewModel.kt; app/src/main/java/com/trooi/app/ui/TroOiApp.kt; app/src/main/java/com/trooi/app/ui/components/RoomLedgerComponents.kt; app/src/main/java/com/trooi/app/features/organization/OperatorViewModel.kt; app/src/main/java/com/trooi/app/features/organization/OperatorWorkspace.kt; app/src/main/java/com/trooi/app/features/tenancy/RentalViewModel.kt; app/src/main/java/com/trooi/app/features/tenancy/RentalWorkspace.kt; app/src/main/java/com/trooi/app/features/tenant/TenantPovScreens.kt; app/src/main/java/com/trooi/app/features/landlord/LandlordScreens.kt; app/src/main/java/com/trooi/app/features/notifications/NotificationScreens.kt; app/src/main/java/com/trooi/app/features/shared/V1RentalGateway.kt; app/src/main/java/com/trooi/app/features/shared/V1ContractGateway.kt.
**Interfaces:** SourceTarget(type,id,tenancyId?,organizationId?,roomId?); SourceNavigation(originPage,originContext,target); resolveSource(target,access) -> authorized route/unavailable. Reuse OperatorRoute/RentalRoute; add exact BillingDetail/ReceiptDetail where collections currently lose source ID, avoid second parallel stack.

- [ ] Reducer tests assert six Ledger targets with room/tenancy/org IDs; notification payment/receipt/incident opens exact detail, Back→notification→authorized caller; missing/deleted source or revoked access→safe source-unavailable/root.
- [ ] Give LedgerNavStrip/LedgerAttentionRow onClick and accessibility role; map actual six labels in HTML to source surfaces, not fabricated routes. Dashboard attention rows carry backend source ID and scope; absent source disables with explicit state.
- [ ] Root routes entry context/resource into nested workspaces, not general categories. Charge uses parent billing cycle and focuses charge ID; tenant finance/incident cards open direct details.
- [ ] Resolve parent scope via existing authorized detail APIs; never infer operator org from first item. Protect navigation generation/context on async resolution.
- [ ] Run .\gradlew.bat :app:testDebugUnitTest --tests com.trooi.app.core.model.SourceNavigationTest --rerun --no-daemon; :app:assembleBackendDebug. Instrumentation click Ledger rows/notification target and Back using real components/seeded backend; runnable device command included Task 22.

**Expected:** source fidelity and Back provenance survive context changes without leaking source access.
**Commit boundary:** fix(android): route ledger and notifications to exact sources.

### Task 15: Native Google map and public discovery

**Depends:** 10. **Worktree:** I.
**Files — create:** app/src/main/java/com/trooi/app/features/discovery/NativeMapView.kt; app/src/main/java/com/trooi/app/features/discovery/MapSelection.kt; app/src/test/java/com/trooi/app/features/discovery/MapSelectionTest.kt; app/src/androidTestBackendDebug/java/com/trooi/app/features/NativeMapSmokeTest.kt.
**Files — modify:** app/build.gradle.kts; app/src/main/AndroidManifest.xml; app/src/main/java/com/trooi/app/features/tenant/GuestPovScreens.kt; app/src/main/java/com/trooi/app/ui/TroOiViewModel.kt; app/src/main/java/com/trooi/app/core/model/FeatureProjections.kt; app/src/main/java/com/trooi/app/features/discovery/PublicDiscoveryFilters.kt.
**Interfaces:** NativeMapView(publicMarkers:List<PublicListingCard>, selectedPoint:PublicGeoPoint?, onCameraCenter, onMarkerListing, onPick) uses MapView/AndroidView Activity lifecycle; search selected camera uses existing repository coordinates/radius/price contract.

- [ ] Resolve current SDK baseline: candidate com.google.android.gms:play-services-maps:20.0.0 verified in official release notes at plan date; pin only after dependency/AAR compatibility build. Run :app:dependencyInsight --dependency play-services-maps --configuration backendDebugRuntimeClasspath and :app:assembleBackendDebug. If incompatible, record precise failure and choose documented compatible SDK version without changing provider/toolchain/scope; rerun checks and record pin in evidence.
- [ ] Add trooiMapsApiKey/env TROOI_MAPS_API_KEY manifest placeholder; empty config renders explicit config/error state but does not crash unrelated app. Restrict cloud key to com.trooi.app.backenddev/debug SHA-1 and release package/SHA-1; enable Maps SDK/billing outside Git. Existing ACCESS_COARSE_LOCATION supports approximate center.
- [ ] Implement native tiles/pan/zoom/public markers, marker preview→Listing, explicit camera “Tìm khu vực này”, price/radius controls. Optional current location uses Android LocationManager, foreground permission only; deny/no fix keeps camera usable.
- [ ] Tests assert markers only PUBLISHED/publicLocation, null public pin never exact fallback; camera/picker events produce transport points but no invented labels; deny/approximate retain manual camera search. Bind lifecycle onCreate/start/resume/pause/stop/destroy/save state without retaining Application context.
- [ ] Run .\gradlew.bat :app:testDebugUnitTest --tests com.trooi.app.features.discovery.MapSelectionTest --rerun --no-daemon; :app:assembleBackendDebug; :app:lintDebug. Device smoke verifies real tiles/gestures/marker target/offline and permission denial. Check known SDK/GMS renderer issues, no suppression to fake PASS.

**Expected:** real native Guest Map V1; actual selected version and device GMS logged.
**Commit boundary:** feat(android): add native v1 public listing map.
**Reference:** [Google Maps release notes](https://developers.google.com/maps/documentation/android-sdk/release-notes). Exact version is execution-tested pin, not product invariant.

### Task 16: Private/public operator map pickers

**Depends:** 15. **Worktree:** I.
**Files — modify:** app/src/main/java/com/trooi/app/features/discovery/MapSelection.kt; app/src/main/java/com/trooi/app/features/discovery/NativeMapView.kt; app/src/main/java/com/trooi/app/features/organization/OperatorWorkspace.kt; app/src/main/java/com/trooi/app/features/organization/OperatorViewModel.kt; app/src/main/java/com/trooi/app/features/shared/V1ContractGateway.kt; app/src/test/java/com/trooi/app/features/discovery/MapSelectionTest.kt; app/src/androidTestBackendDebug/java/com/trooi/app/features/NativeMapSmokeTest.kt.
**Interfaces:** PrivateOperationalLocation(address,point) and PublicListingLocation(point) distinct form state; existing createProperty/createListing transport still serializes explicit points.

- [ ] Test private pin change does not set public pin; create property/listing blocked until required independent selection; blank label/public-point absence never copied from exact address/location.
- [ ] Replace numeric lat/lng fields with map pin pickers + address text + separate public confirmation. Coordinate numbers remain DTO only; no textual geocoder/type/availability defaults.
- [ ] Preserve edit/publish guards, loading/error/access states. Verify device pick/save/read and public guest projection excludes operational address.
- [ ] Run MapSelectionTest, pnpm exec tsx --test tests/core/listing-search.behavior.test.ts tests/core/property.behavior.test.ts; :app:assembleBackendDebug and NativeMapSmokeTest on device.

**Expected:** operator can choose locations without raw-coordinate UX or privacy fallback.
**Commit boundary:** feat(android): separate private and public location pickers.

### Task 17: Authenticated safe Trust submission backend

**Depends:** 9. **Worktree:** I.
**Files — modify:** src/modules/audit-trust/dto/index.ts; src/modules/audit-trust/contracts/index.ts; src/modules/audit-trust/controllers/audit-trust.controller.ts; src/modules/audit-trust/services/audit-trust.service.ts; src/persistence/ports/listing.repository.ts; src/infrastructure/database/repositories/listing.repository.ts; src/main.ts; package.json; pnpm-lock.yaml; tests/core/incident-trust.behavior.test.ts; tests/core/support/in-memory-transaction-manager.ts; tests/core/support/payment-gateway-http-harness.ts.
**Files — create/test:** tests/core/trust-submission.http.test.ts; tests/integration/persistence/trust-submission.integration.ts.
**Interfaces:** SubmitTrustReportDto {listingId?:string,reviewId?:string,reason:TrustReportReason,note?:string}; submitReport(input,userId): Promise<TrustReport>. ListingRepository.lockListing(id):Promise<void> on tx connection; same lock used by updates naturally conflicts with row update.

- [ ] HTTP tests: unauthenticated401; spoof reporter/status/resolvedAt400; no/double target400; missing/unpublished404; Review422; authenticated public Listing201/reporter principal/SUBMITTED; GET reports403. Reporter need not be tenancy member.
- [ ] Derive actor from CurrentUser at controller; service parameter never taken from payload. Lock/revalidate PUBLISHED target in same transaction then insert; report action never deletes Listing/Review or creates score. Disable legacy recipient report notification until permission contract exists.
- [ ] Apply note default2000 Unicode code points (Array.from(note).length) and body8KiB at report route, not global downgrade for all endpoints. Register route-specific express.json parser ahead of default parser using Nest bodyParser:false + normal parser for others; add express as direct dependency at the version already resolved by @nestjs/platform-express if import requires it, preserve existing @types/express. HTTP tests prove note2001→400, body>8192 bytes→413, normal unrelated endpoint parser unchanged. Evidence refs/uploads remain rejected/gated.
- [ ] SQL race test holds Listing lock, unpublish/report competitors serialize; report succeeds only if public at insert commit, otherwise404. Verify actual stored reporter and target unchanged by submission.
- [ ] Run pnpm exec tsx --test tests/core/trust-submission.http.test.ts tests/core/incident-trust.behavior.test.ts; pnpm exec tsx --test --test-concurrency=1 tests/integration/persistence/trust-submission.integration.ts; pnpm typecheck; pnpm lint; pnpm build.

**Expected:** authenticated Listing reporting safe; global internal list not exposed to app users.
**Commit boundary:** fix(trust): authorize principal-derived v1 report submission.

### Task 18: Listing Report form and safe receipt

**Depends:** 17,10. **Worktree:** I.
**Files — create:** app/src/main/java/com/trooi/app/features/shared/V1TrustGateway.kt; app/src/main/java/com/trooi/app/features/shared/TrustReportScreen.kt; app/src/test/java/com/trooi/app/features/TrustReportSubmissionTest.kt.
**Files — modify:** app/src/main/java/com/trooi/app/core/model/Models.kt; app/src/main/java/com/trooi/app/ui/TroOiViewModel.kt; app/src/main/java/com/trooi/app/ui/TroOiApp.kt; app/src/main/java/com/trooi/app/features/tenant/TenantScreens.kt; app/src/main/java/com/trooi/app/core/network/dto/BackendDtos.kt.
**Interfaces:** V1TrustGateway.submitListingReport(listingId,reason,note): TrustReportReceipt; AppPage.TrustReport(listingId) requires authenticated state + authorized public target; reason UI maps exact canonical enum.

- [ ] Tests inspect outbound body only listingId/reason/note; no client actor/status. Unauthenticated action routes login with safe return; target404 shows unavailable, Review action disabled, submit double-tap guarded without inventing provider-style idempotency.
- [ ] Form opens from actual Listing detail, shows loading/error and receipt of own new report only; no global history/moderation route or public-score copy. Cancel/Back returns Listing caller.
- [ ] Run .\gradlew.bat :app:testDebugUnitTest --tests com.trooi.app.features.TrustReportSubmissionTest --rerun --no-daemon; :app:assembleBackendDebug; pnpm openapi:generate; Android OpenAPI alignment test.

**Expected:** approved submission journey works over hardened endpoint.
**Commit boundary:** feat(android): submit safe authenticated listing reports.

### Task 19: Explicit Payment-to-Deposit Application

**Depends:** 10,9. **Worktree:** I.
**Files — modify:** app/src/main/java/com/trooi/app/features/shared/V1RentalGateway.kt; app/src/main/java/com/trooi/app/features/tenancy/RentalViewModel.kt; app/src/main/java/com/trooi/app/features/tenancy/RentalWorkspace.kt.
**Files — create/test:** app/src/test/java/com/trooi/app/features/tenancy/DepositApplicationTest.kt.
**Interfaces:** applyPaymentToDeposit(paymentId:String,depositId:String,amount:String): RentalDepositApplication; RentalDepositApplication(id,paymentId,depositId,appliedAmount,appliedAt) mirrors existing API. Serialize body {targetId:depositId,amount}, matching existing ApplyAmountDto; do not send depositId as request field.

- [ ] Assert explicit button submits exact chosen payment/deposit/same tenancy; callback checkout never calls application. Tenant read-only, operator-only action; cross-tenancy and amount overflow render server guard error without optimistic success.
- [ ] Add gateway POST finance/payments/:id/deposit-applications; select deposit/amount from authorized tenancy, refresh Payment/Deposit/events after success. Keep allocation and Receipt separate controls.
- [ ] Run DepositApplicationTest; pnpm exec tsx --test tests/core/finance.behavior.test.ts; pnpm exec tsx --test --test-concurrency=1 tests/integration/persistence/guards/finance-guards.integration.ts tests/integration/persistence/guards/finance-concurrency.integration.ts; :app:assembleBackendDebug.

**Expected:** actual confirmed manual/gateway Payment can be explicitly applied, never auto funded.
**Commit boundary:** feat(android): apply confirmed payment to deposit explicitly.

### Task 20: Shared Settings/Help and remaining V1 presentation gates

**Depends:** 10,11,14,19. **Worktree:** I.
**Files — create:** app/src/main/java/com/trooi/app/features/shared/SharedSettingsHelpScreens.kt; app/src/test/java/com/trooi/app/features/SharedSurfaceNavigationTest.kt.
**Files — modify:** app/src/main/java/com/trooi/app/core/model/Models.kt; app/src/main/java/com/trooi/app/ui/TroOiApp.kt; app/src/main/java/com/trooi/app/ui/TroOiViewModel.kt; app/src/main/java/com/trooi/app/features/tenant/GuestPovScreens.kt; app/src/main/java/com/trooi/app/features/tenant/TenantPovScreens.kt; app/src/main/java/com/trooi/app/features/landlord/LandlordScreens.kt; app/src/main/java/com/trooi/app/features/tenancy/RentalWorkspace.kt; app/src/test/java/com/trooi/app/features/V1CompletionContractTest.kt.
**Interfaces:** AppPage.Settings/Help; caller-aware navigation from Task 14; settings restore-enabled hint uses Task 11 store, no fake preferences/backend settings.

- [ ] Tests assert Account selected in Operations, Settings/Help Back caller, Notice scoped selected tenancy, Claim/Review/Inquiry Activity unavailable decisions disabled with reason.
- [ ] Implement minimal HTML-backed shared surfaces and actionable existing session/context/logout controls; Help explains supported paths, no invented contact endpoint. Align tenancy Notice wording in Android.
- [ ] Preserve current styles; use Impeccable/appropriate installed UI filters at execution, never use UI polish to expand scope. Source-only regression tests remain supplemental to reducer/component tests.
- [ ] Run SharedSurfaceNavigationTest and full :app:testDebugUnitTest --rerun --no-daemon; :app:assembleBackendDebug; :app:lintDebug.

**Expected:** shared V1 entry states/navigation complete; intentionally OPEN decisions remain visibly gated.
**Commit boundary:** feat(android): close shared v1 surfaces and navigation states.

### Task 21: Contract parity and integration runtime verification

**Depends:** 12,14,16,18,20. **Worktree:** I.
**Files — regenerate/modify:** docs/api/openapi.json; tests/verification/openapi-client-contract.test.ts; tests/core/support/payment-gateway-http-harness.ts; tests/integration/persistence/gateway-test-support.ts; app/src/test/java/com/trooi/app/core/network/BackendOpenApiAlignmentTest.kt; app/src/test/java/com/trooi/app/core/network/BackendRuntimeContractTest.kt; tests/e2e/flow-catalog.yaml; tests/e2e/validate-v1-coverage.ts.
**Files — create:** tests/e2e/v1-integration-runtime.ts; tests/e2e/flows/gateway-checkout.yaml; tests/e2e/flows/trust-submission.yaml; tests/e2e/cases/gateway-checkout.yaml; tests/e2e/cases/trust-submission.yaml.
**Interfaces:** Existing backend runtime access flow + new durable checkout/Trust scenarios; tests use real HTTP/DB, isolated verifier only in test harness. Production sandbox/live gates remain separate. Extend startGatewayHttpHarness from Task 3 with real Postgres repositories/transaction manager and real ResourceAuthorizationService; only Google verifier/provider HTTP client are replaced in this automated harness. Runtime script requires TEST_DATABASE_URL=trooi_test and closes HTTP server/pools.

- [ ] Regenerate OpenAPI from final target; ensure Idempotency-Key required, gateway status/new header parity, 204/body absence, restricted manual DTO, Trust actor removal. Do not weaken mismatch tests or reintroduce stale snapshot.
- [ ] Extend flow catalog coverage with checkout/Trust contracts and matching case YAMLs (IDs GW-01-H01/GW-01-E01, TR-01-H01/TR-01-E01 referencing GW-01/TR-01). Existing coverage validator must see all new flows covered; no weakened coverage assertion. Execute authenticated cross-actor HTTP tests and persisted checkout sequence/Deposit separation using disposable fixture. New runtime script fails if env missing, never claims live Google/MoMo.
- [ ] Run pnpm exec tsx tests/e2e/v1-integration-runtime.ts; pnpm e2e:coverage; pnpm exec tsx --test tests/audit/low-level-architecture/runtime.access.test.ts tests/verification/openapi-client-contract.test.ts with DATABASE_URL dedicated seeded runtime DB, not concurrent reset DB.
- [ ] Run full backend gates plus persistence files one-at-a-time/group --test-concurrency=1; run full debug units and :app:testBackendDebugUnitTest --rerun --no-daemon, assemble/lint. Record exact commands/results, never reuse audit 280/284 count.

**Expected:** final contracts/behavior runnable on target code; runtime records real persistence.
**Commit boundary:** test(v1): verify integrated contracts and runtime behavior.

### Task 22: Real device, Google, native Map and MoMo sandbox acceptance

**Depends:** 21. **Worktree:** I.
**Files — create:** docs/testing/v1-integration-device-runbook.md; tests/e2e/maestro/v1-integration-navigation.yaml.
**Files — execute:** app/src/androidTestBackendDebug/java/com/trooi/app/features/SessionHintsPersistenceTest.kt; app/src/androidTestBackendDebug/java/com/trooi/app/features/SourceNavigationSmokeTest.kt; app/src/androidTestBackendDebug/java/com/trooi/app/features/NativeMapSmokeTest.kt.
**Interfaces:** backendDebug package com.trooi.app.backenddev, real Google audience/config, restricted Maps key, MoMo sandbox + externally reachable HTTPS IPN. No production payments.

- [ ] Run adb devices -l; use configured device serial via adb -s <serial> and record Android/GMS versions. Build/install :app:installBackendDebug with actual backend URL/Google client ID/Maps key supplied by local env; no secret command output/logcat dump.
- [ ] Run .\gradlew.bat :app:connectedBackendDebugAndroidTest -PtrooiInstrumentationBuildType=backendDebug --no-daemon. Native tests require backendDebug source set, not demo debug. Run maestro test tests/e2e/maestro/v1-integration-navigation.yaml if Maestro installed; required manual navigation/video evidence remains acceptable for provider account selectors, not replaced by fake account.
- [ ] Real Google: sign in user A, select tenancy/org B, background then adb shell am force-stop com.trooi.app.backenddev and adb shell monkey -p com.trooi.app.backenddev 1. Verify returning credential→backend /me→correct selected context; repeat logout/restart, different account, revoked credential, offline/cancel. No need to assert silent provider selection on every OS.
- [ ] Map: real tiles/pan/zoom/marker→Listing/camera search; deny/approximate permission; private/public picker save and public address isolation; theme/font/Back smoke. Record Maps SDK pin, signing/package config and renderer issues honestly.
- [ ] MoMo sandbox: create-response HMAC verified (missing/different signature is integration blocker); provider handoff before Payment; return before IPN pending then success exactly one Payment; return after IPN; process restart; response-loss POST replay same IDs; repeated signed IPN. Compare provider dashboard/transId + local DB amounts/identity and no allocation/Deposit/Receipt side effects.
- [ ] Run Trust submission real authenticated public Listing; operator explicit Deposit Application; Guest/Tenant/Landlord/notification/source Back journeys. Capture redacted evidence and mark each scenario PASS/FAIL/UNVERIFIED.

**Expected:** all device/provider gates evidenced. Missing device/keys/billing/credential/public IPN URL blocks READY, not other independent implementation tasks.
**Commit boundary:** docs(test): record executable v1 device and sandbox scenarios. Evidence artifacts outside repo; runbook includes redacted artifact references.

### Task 23: Final exact-HEAD gates, checklist and merge readiness

**Depends:** 22 and all preceding tasks. **Worktree:** I only.
**Files — modify:** docs/designs/v1/app-pov-checklist.md; app/docs/v1-app-completion-report-20261002.md (append superseding evidence reference, do not rewrite historic results).
**Files — create:** docs/testing/v1-integration-evidence-20261005.md.
**Interfaces:** Evidence record fields SHA, worktree diff/variant/config, command/scenario, exit/result, artifact path, remaining blocker. Ready only if required automated/runtime/device/provider gates all pass.

- [ ] Review whole baseline..target diff with code-review and relevant Impeccable audit; fix actual issues in separate intent commits and rerun affected gates. Inspect no lost Room Ledger redesign, raw-coordinate fields, secret/debug bypass, conflict markers, duplicate authority, stale import/shim or untracked generated artifact. Do not delete user's prompt/spec/local work.
- [ ] Reconcile every promoted/checklist item using implementation+contract+states+tests+runtime evidence; retain OPEN/FUTURE gates. Link authoritative spec, per-task commits and actual evidence. Record unresolved external prerequisites as blocker, never tick unsupported DoD.
- [ ] Commit only evidence/checklist files: docs(v1): reconcile integration acceptance evidence. Before final gate verify implementation tree clean and record exact HEAD. Evidence-only commit does not silently inherit old source validation; run all final gates on this HEAD.
- [ ] Run, in I with disposable test DB configured, commands below sequentially. Store logs outside repo; inspect every exit, zero required skips/cancellations. DATABASE_URL runtime DB and TEST_DATABASE_URL reset test DB must be isolated. Rebuild/reinstall device artifact if code changed since Task 22.

~~~powershell
git rev-parse HEAD
git status --short
pnpm typecheck
pnpm lint
pnpm build
pnpm test:conformance:database-v1
pnpm test
pnpm test:persistence:migration
pnpm exec tsx --test --test-concurrency=1 tests/integration/persistence/payment-gateway.integration.ts tests/integration/persistence/payment-gateway-concurrency.integration.ts tests/integration/persistence/trust-submission.integration.ts
pnpm exec tsx --test --test-concurrency=1 tests/integration/persistence/guards/finance-guards.integration.ts tests/integration/persistence/guards/finance-concurrency.integration.ts
pnpm exec tsx tests/e2e/v1-integration-runtime.ts
pnpm e2e:coverage
.\gradlew.bat :app:testDebugUnitTest :app:testBackendDebugUnitTest --rerun --no-daemon
.\gradlew.bat :app:assembleBackendDebug :app:lintDebug --no-daemon
.\gradlew.bat :app:connectedBackendDebugAndroidTest -PtrooiInstrumentationBuildType=backendDebug --no-daemon
git diff --check
git diff --cached --check
git status --short
~~~

- [ ] Use append-only external final-verification receipt keyed to committed evidence HEAD for final exit results; link receipt path from evidence file before committing, avoiding recursive “update evidence SHA →new HEAD” ambiguity. If later repo edits occur, record new HEAD and rerun relevant/final gates; do not claim exact-HEAD evidence for old SHA.
- [ ] Report HEAD, intent commits, READY_TO_MERGE YES/NO, tests and remaining blockers. Upstream still points frontend unless explicitly corrected; no default push, no main merge/push. Keep payment worktree/backup until preserved work and integrated commits checked.

**Expected:** READY_TO_MERGE: YES only with all required evidence; otherwise NO with precise remaining blockers.
**Commit boundary:** evidence/checklist commit above; review fixes get their own commits. External receipt is not a source change.

## Coverage and deliberately unclosed scope

| Approved spec | Plan ownership |
| --- | --- |
| 1–2 authority/reconciliation | Tasks 0–1,23 |
| 3 ownership/architecture | Work packages; Tasks 9–12,17 |
| 4 manual boundary | Task 4; correction-call-site audit included |
| 5–6 durable gateway/state/verification/replay | Tasks 3,5–8,12,22 |
| 7 concrete context/navigation/Room FSM | Tasks 10,13–14 |
| 8 restore | Tasks 11–12,22 |
| 9 native Map | Tasks 15–16,22 |
| 10 safe Trust | Tasks 17–18 |
| 11 migration/selective integration | Tasks 2,6,8–9 |
| 12 dependency order | Dependency graph/task headers |
| 13 acceptance/evidence | Per-task gates; Tasks 21–23 |
| 14 OPEN/FUTURE | Tasks 1,18,20; no implementation closes these |
| 15 review handoff | Plan review before execution |

Still OPEN/FUTURE: geocoder/type/availability, Payment Claim evidence/confirmation, Review eligibility/publication/moderation, anonymous reporting/moderation/evidence/rate-limit policy, unallocated/over-allocation/deposit-requirement-change policy; generic/mandatory gateway, backend long-lived session subsystem and other Canonical FUTURE. No provider query/capture-two-step subsystem required.

Self-review at plan-writing time: dependencies/interfaces and all spec sections mapped; replay endpoint simplified; terminal transitions/provider stage consistent; numeric defaults separated from product invariants; DB overlap evidence and device commands explicit. Files marked create are future deliverables, not files claimed present. Runtime/provider/build gates in this plan are expected outcomes, **not executed PASS results**.

Execution status — 2026-10-05: Tasks 0–7 are complete and reviewed. Payment commits: 010cb86, 6966db8, 517c1db, f1a739c, 4ca8054, 9b133e8. Task 8 and later remain in progress; live MoMo/device gates remain UNVERIFIED and this plan does not claim READY_TO_MERGE.
