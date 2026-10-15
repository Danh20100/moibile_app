# Full-stack Runtime Connection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nối Android TrọƠi với NestJS Backend và PostgreSQL/PostGIS qua contract OpenAPI đã xác minh, không invent API hoặc business rule ở client.

**Architecture:** Backend/Database đã GREEN và nằm trong staging. Duy Anh làm một lane support để harden auth + OpenAPI client contract; KhanhBang làm một lane Frontend runtime để merge staging, thêm transport/auth adapter và nối các vertical slice. Mọi Backend fix phải merge staging trước khi Frontend consume.

**Tech Stack:** Android Compose/Kotlin/Hilt, Google Credential Manager, HTTP client Android, NestJS 12, Swagger/OpenAPI 3, Kysely, PostgreSQL/PostGIS.

**Spec:** `docs/superpowers/specs/2026-09-30-full-stack-runtime-connection-design.md`

## Global Constraints

- Android là sản phẩm chính; Web giữ marketing-only.
- Frontend không truy cập Database trực tiếp.
- Không global `LANDLORD | TENANT` role.
- Không đưa FUTURE vào CURRENT.
- Google ID Token là bearer credential của phase này; không tạo custom session JWT.
- OpenAPI phải mô tả runtime thật trước khi Android map DTO.
- Không commit trực tiếp vào `integration/full-stack-sync-runtime-staging` trong lúc triển khai lane.
## Review Focus

- Bearer rỗng/sai/chưa verify phải bị 401; public route vẫn truy cập được.
- User có cả owner + tenant relationship phải nhận đủ capability, không bị ép một role.
- Public Listing không được leak operational exact address hoặc tenant data.
- OpenAPI generated phải deterministic và chứa schema/security thật, không chỉ operation name.
- Android mất mạng/token hết hạn/backend 4xx phải fail rõ, không fallback sang demo business truth.

---

### Task 0: Chuẩn bị hai lane tích hợp

**Files:** không sửa business code.

**Interfaces:**
- Consumes: staging sau coordination-doc commit; Frontend reconcile `b3c14af`.
- Produces: `backend/full-stack-contract-support` và `frontend/full-stack-runtime-connection`.

- [ ] Fetch/prune toàn bộ remote.
- [ ] Tạo Backend support branch từ staging mới nhất.
- [ ] Tạo Frontend runtime branch từ `frontend/backlog-v1-reconciliation`, sau đó merge staging mới nhất vào branch này.
- [ ] Xác nhận `git status` sạch ở cả hai lane và ghi exact SHA vào handoff report.
### Task 1: Harden authentication runtime

**Owner:** Duy Anh

**Files:**
- Modify: `src/common/guards/auth.guard.ts`
- Modify: `src/modules/identity-access/services/identity-access.service.ts`
- Modify: `src/modules/identity-access/identity-access.module.ts` nếu cần provider seam
- Modify/Create: `src/common/**` cho typed authenticated principal/current-user helper
- Test: `tests/audit/low-level-architecture/runtime.access.test.ts`
- Test: thêm focused auth test dưới `tests/integration/` hoặc `src/modules/identity-access/**/*.spec.ts`

**Interfaces:**
- Consumes: Google ID Token verifier hiện có.
- Produces: verified request principal gồm tối thiểu `userId`, `provider`, `issuer`, `subject`; protected request chỉ đi tiếp khi token verify thành công.

- [ ] Viết test: arbitrary non-empty bearer phải trả `401`.
- [ ] Viết test: public `/health` và `/listings/public` không cần bearer.
- [ ] Viết test offline với fake verifier: valid Google token gắn verified principal vào request context.
- [ ] Refactor verification seam để `POST /identity-access/auth/google` và `AuthGuard` dùng cùng logic verify, không gọi Google thật trong test.
- [ ] `AuthGuard` trở thành async, verify token thật và reject verifier error bằng `UnauthorizedException`.
- [ ] Chạy focused auth/runtime tests đến GREEN.
- [ ] Commit: `fix(auth): verify google bearer tokens on protected routes`.
### Task 2: Thêm session-context theo relationship

**Owner:** Duy Anh

**Files:**
- Modify: `src/modules/identity-access/controllers/identity-access.controller.ts`
- Modify: `src/modules/identity-access/services/identity-access.service.ts`
- Modify/Create: `src/modules/identity-access/dto/index.ts` hoặc contract response riêng
- Modify: `src/persistence/ports/organization.repository.ts`
- Modify: `src/infrastructure/database/repositories/organization.repository.ts`
- Reuse: `TenancyRepository.findParticipantsByUser(userId)`
- Test: identity service/controller + persistence tests liên quan

**Produces:** `GET /identity-access/me` trả `userId`, `operatedOrganizationIds[]`, `linkedTenancyIds[]` từ relationship thật.

- [ ] Viết test user không có relationship → hai list rỗng.
- [ ] Viết test một user vừa primary owner vừa linked participant → có cả hai list.
- [ ] Thêm repository query semantic để lấy Organization theo `primaryOwnerUserId`, không scan toàn bộ ở controller.
- [ ] Dedupe/sort ID để response deterministic.
- [ ] Endpoint dùng principal từ Task 1, không nhận `userId` từ client.
- [ ] Chạy unit + persistence tests đến GREEN.
- [ ] Commit: `feat(identity): expose relationship-scoped session context`.
### Task 3: Làm OpenAPI đủ để Android consume

**Owner:** Duy Anh

**Files:**
- Modify: `src/openapi.ts`
- Modify: controller/DTO/response contract của các endpoint được consume
- Modify/Create: `tests/verification/openapi-client-contract.test.ts`
- Regenerate: `docs/api/openapi.json`
- Modify: `docs/api/README.md` nếu cần hướng dẫn generate/verify

**Consumes:** auth/session context từ Task 1–2.
**Produces:** OpenAPI có named schemas, request/response schema và security metadata cho vertical slices.

- [ ] Test phải fail nếu `components.schemas` rỗng.
- [ ] Test protected operation phải có bearer security; `/health`, `/listings/public`, `/identity-access/auth/google` phải public.
- [ ] Test request schema cho Google auth, Inquiry và các command được dùng.
- [ ] Test response schema cho session context, Listing public, Organization/Property/Room, Tenancy, Finance/Receipt, Incident.
- [ ] Bổ sung Swagger decorators/type metadata mà không đổi business behavior.
- [ ] Chạy `pnpm openapi:generate` hai lần và xác nhận lần hai không tạo diff.
- [ ] Chạy `pnpm typecheck`, conformance và full test.
- [ ] Commit: `feat(openapi): publish client-consumable runtime contract`.
### Task 4: Frontend transport foundation — chạy song song với Task 1–3

**Owner:** KhanhBang

**Files:**
- Modify: `app/build.gradle.kts`
- Create: `app/src/main/java/com/trooi/app/core/network/BackendApi.kt`
- Create: `app/src/main/java/com/trooi/app/core/network/BackendClient.kt`
- Create: `app/src/main/java/com/trooi/app/core/network/AuthTokenProvider.kt`
- Create: `app/src/main/java/com/trooi/app/core/network/dto/**`
- Create: `app/src/main/java/com/trooi/app/core/data/BackendTroOiRepository.kt`
- Add a debuggable backend-backed build variant/source set; giữ debug demo preview tách biệt.

**Interfaces:**
- Base URL từ BuildConfig/environment.
- Bearer interceptor đọc token từ `AuthTokenProvider`.
- Transport DTO không phải UI/business projection.

- [ ] Thêm HTTP client dependency và pin version trong Gradle.
- [ ] Viết unit test cho base URL normalization, bearer header và error mapping bằng fake/mock HTTP layer.
- [ ] Tạo transport skeleton chỉ từ operation/path đã có; không đoán field schema khi OpenAPI chưa GREEN.
- [ ] Tạo backend-backed debuggable variant để chạy smoke với server local.
- [ ] Build variant mới phải compile trước khi map business DTO.
- [ ] Commit: `feat(android): add backend transport foundation`.
### Task 5: Backend support gate và Frontend re-sync

**Owners:** Duy Anh → coordinator merge → KhanhBang

- [ ] Duy Anh chạy Backend gate đầy đủ trên exact support SHA:
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm test:core-foundation`
  - `python -m unittest discover -s tests/database -p "test_*.py"`
  - PostgreSQL provision + `pnpm db:migrate` + `pnpm db:seed`
  - `pnpm test:persistence:migration`
  - `pnpm test:conformance:database-v1`
  - `pnpm test`
  - `pnpm openapi:generate` và generated diff check.
- [ ] Duy Anh push exact SHA và report GREEN; không tự merge staging.
- [ ] Coordinator merge Backend support vào staging bằng merge commit.
- [ ] KhanhBang fetch staging mới và merge vào `frontend/full-stack-runtime-connection`.
- [ ] Xác nhận `docs/api/openapi.json` mà Frontend đang đọc đúng SHA vừa merge.

**Gate:** Không bắt đầu DTO mapping production nếu Task 3 chưa GREEN.
### Task 6: Nối Google auth và session context trên Android

**Owner:** KhanhBang

**Files:**
- Modify: `app/src/main/java/com/trooi/app/features/auth/AuthScreens.kt`
- Modify: `app/src/main/java/com/trooi/app/ui/TroOiViewModel.kt`
- Modify: `app/src/main/java/com/trooi/app/core/data/TroOiRepository.kt`
- Modify: `app/src/main/java/com/trooi/app/core/data/BackendTroOiRepository.kt`
- Create: `app/src/main/java/com/trooi/app/core/auth/GoogleCredentialAuth.kt`
- Test: auth/session mapping tests dưới `app/src/test/**`

**Produces:** production/backend-backed auth dùng Google ID Token; `UserSession.access` được map từ `/identity-access/me`.

- [ ] Thêm Credential Manager/Google ID dependencies cần thiết.
- [ ] Viết test repository: verified auth response + `/me` owner/tenant IDs map đúng `AccessCapabilities`.
- [ ] Viết test token invalid/expired → session bị từ chối, không giữ capability cũ.
- [ ] Thay production login flow bằng Google sign-in; bỏ/ẩn password/signup/reset khỏi backend-backed surface.
- [ ] Sau login, lưu token trong memory/session provider phù hợp phase này và gọi `/identity-access/me`.
- [ ] Logout phải xóa token + session context local.
- [ ] Commit: `feat(android): connect google auth and relationship session`.
### Task 7: Nối Public Discovery và Inquiry vertical slice

**Owner:** KhanhBang

**Files:**
- Modify: `BackendApi.kt`, transport DTOs và `BackendTroOiRepository.kt`
- Modify: discovery/listing UI ở `app/src/main/java/com/trooi/app/features/tenant/**`
- Test: mapping + repository + ViewModel tests

- [ ] Map `GET /listings/public` theo schema OpenAPI, chỉ lấy public projection.
- [ ] Test Listing không PUBLISHED không xuất hiện trong discovery.
- [ ] Test public DTO không có operational exact address/tenant data.
- [ ] Nối loading/error/empty state vào discovery thật; không fallback silently sang DemoData.
- [ ] Nối `POST /inquiries` bằng authenticated bearer và contact intent message.
- [ ] Test Inquiry failure không tạo local booking/chat state và không báo success giả.
- [ ] Smoke bằng backend-backed debuggable variant với server local + PostgreSQL seed.
- [ ] Commit: `feat(android): connect public listings and inquiry runtime`.
### Task 8: Nối relationship-scoped reads

**Owner:** KhanhBang

**Files:**
- Modify: `BackendApi.kt`, transport DTOs, mapper và `BackendTroOiRepository.kt`
- Modify: `LandlordScreens.kt`, `TenantScreens.kt`, `TroOiViewModel.kt` khi cần
- Test: scoped mapping/repository tests

- [ ] Với mỗi `operatedOrganizationId`, load Organization → Property → Room theo endpoint/query OpenAPI.
- [ ] Với Room được phép, load Incident và các read liên quan; client vẫn filter defense-in-depth nhưng server là authority.
- [ ] Với mỗi `linkedTenancyId`, load Tenancy → Terms → Notices → Billing Cycle/Receipt data mà contract hiện có cho phép.
- [ ] Không gọi endpoint của Organization/Tenancy không nằm trong session context.
- [ ] Dashboard chưa có backend read model thì giữ explicit pending state; không tính từ Room/Payment local.
- [ ] Test user có cả owner + tenant context nhìn thấy đúng cả hai surface.
- [ ] Test foreign Organization/Tenancy fixture không lọt vào UI projection.
- [ ] Commit: `feat(android): connect scoped operations and tenant reads`.
### Task 9: Frontend verification gate

**Owner:** KhanhBang

- [ ] Chạy Android gate trên exact SHA:
  - `./gradlew.bat testDebugUnitTest`
  - backend-backed variant unit tests
  - `./gradlew.bat lintDebug`
  - assemble debug/backend-backed debug
  - `assembleDebugAndroidTest`
  - `bundleRelease`
- [ ] Nếu có device/emulator: chạy instrumentation smoke cho login, public discovery và Inquiry.
- [ ] Chạy Web gate: `npm run check`, `npm test`, `npm run test:browser` trong `web/`.
- [ ] Static grep active Android: không `UserRole`, `RoomUi`, `BookingUi`, `SubscriptionPlan`, debt-derived payment hoặc hardcoded exact public address.
- [ ] Xác nhận release/backend-backed repository không còn `backendUnavailable()` cho các vertical slice đã chọn.
- [ ] Commit verification report dưới `app/docs/` với exact SHA và các gate PASS/NOT RUN có lý do.

**Gate:** Chỉ report `READY_TO_MERGE: YES` khi branch đã chứa staging mới nhất và tất cả gate bắt buộc pass.
### Task 10: Merge Frontend và final full-stack smoke

**Owner:** Coordinator

- [ ] Xác nhận Frontend runtime branch GREEN và dựa trên staging mới nhất.
- [ ] Dry-run merge bằng `git merge-tree`; nếu conflict thì resolve trên branch riêng, không trực tiếp trên staging.
- [ ] Merge `frontend/full-stack-runtime-connection` vào `integration/full-stack-sync-runtime-staging` bằng merge commit.
- [ ] Rerun Backend/Database CI gate trên staging merge SHA.
- [ ] Rerun Android/Web build/test tối thiểu từ staging merge SHA.
- [ ] Chạy vertical smoke với PostgreSQL thật: public listing read, Google auth/session context, protected scoped read, Inquiry write.
- [ ] Xác nhận `docs/api/openapi.json` sạch sau `pnpm openapi:generate`.
- [ ] Ghi final integration report với exact merge SHA, test evidence và known gaps.
- [ ] Chỉ sau final GREEN mới xem phase Frontend ↔ Backend ↔ Database là hoàn thành.

## Vòng lặp contract-gap

Nếu KhanhBang phát hiện endpoint/schema thiếu trong Task 6–8:

1. ghi exact request/response hoặc behavior cần thiết;
2. không workaround trong Frontend;
3. Duy Anh sửa trên `backend/full-stack-contract-support`;
4. Backend gate GREEN;
5. merge Backend support → staging;
6. Frontend merge staging mới và tiếp tục.

Mỗi vòng giữ ownership tách biệt để không tạo conflict chéo.