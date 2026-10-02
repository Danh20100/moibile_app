# Handoff — Full-stack Runtime Integration cho Duy Anh

## Trạng thái bàn giao
- Owner mới: **Duy Anh**.
- Branch tiếp tục: `frontend/full-stack-runtime-connection`.
- Staging contract đã sync: `23b2f40f6d0e718bbd446ce043561aa64c435639`.
- Local integration base trước WIP: `d32dee843b8b72d5c3c5f7c6b1e5719ae38c6541`.
- Backend support đã GREEN trước khi merge staging: `f48bf47dffd67dce63766b64f525e112b0f36cc2`.
- WIP hiện tại **chưa qua Android compile/test gate** và **không READY_TO_MERGE**.

## Mục tiêu còn lại
Hoàn tất đường chạy Android → HTTP/OpenAPI → NestJS → PostgreSQL/PostGIS, sau đó chạy gate Frontend và full-stack smoke trước khi merge Frontend về staging.

Không đổi business authority. Không thêm global role. Không invent endpoint/schema còn thiếu. Không truy cập DB trực tiếp từ Android.

## Phần đã có trước WIP này
Băng đã làm transport foundation và report tại `app/docs/full-stack-runtime-transport-20260930.md`.
Branch đã có backend-backed build variant, OkHttp transport, bearer token provider, fail-closed repository và raw public Listing probe.

## WIP đã triển khai nhưng chưa verify
Các file chính:
- `app/build.gradle.kts`: thêm Gson + Credential Manager + Google ID dependency; thêm `GOOGLE_WEB_CLIENT_ID` từ Gradle/env.
- `core/auth/GoogleCredentialAuth.kt`: skeleton Credential Manager lấy Google ID Token.
- `core/network/BackendClient.kt`: GET/POST JSON, query params, bearer, typed transport error.
- `core/network/BackendApi.kt`: typed calls cho public Listing, Google auth, `/me`, Organization/Property/Room, Tenancy/Terms/Notices, Billing, Incident, Inquiry.
- `core/network/dto/BackendDtos.kt` + `BackendJsonCodec.kt`: transport DTO/parser theo `docs/api/openapi.json` từ staging `23b2f40`.
- `BackendTroOiRepository.kt`: mapping sang Frontend read projections và relationship-scoped reads.
- `FrontendReadSnapshot.kt`: thêm `noticesByTenancy`.
- `TroOiViewModel.kt`, `TroOiApp.kt`, `TenantScreens.kt`: bắt đầu nối Google auth, public runtime loading và backend-backed UI.
- `BackendRuntimeContractTest.kt`: regression tests đang được viết dở.

`git diff --check` tại thời điểm handoff: PASS.

## Những điểm cần audit ngay khi nhận branch
1. Chạy compile trước; WIP có thể còn lỗi type/import do chưa có Android SDK trên máy coordinator.
2. So `BackendDtos.kt`/`BackendJsonCodec.kt` với OpenAPI hiện hành, không đoán field.
3. Xác minh `CreateInquiryDto` chỉ gửi `listingId`, `contactIntentOrMessage`, `status`; không gửi `senderUserId` authority từ client.
4. Public Listing chỉ map `PUBLISHED` và chỉ public location projection; không leak operational address/tenant data.
5. `/identity-access/me` là nguồn duy nhất cho `operatedOrganizationIds` và `linkedTenancyIds`.
6. Former tenant phải giữ read-only history theo backend authorization đã fix; client không được loại historical tenancy chỉ vì ended/left.
7. Dashboard chưa có backend read model thì giữ pending; không tự tính từ Room/Payment.
8. Payment/Deposit/Receipt chỉ map những endpoint/read semantics contract thật sự hỗ trợ; không tạo số liệu suy diễn.

## Không được làm
- Không rebase/force-push.
- Không merge `frontend/full-stack-runtime-connection` vào staging khi chưa GREEN.
- Không sửa canonical/backlog/database authority để hợp thức hóa client.
- Không fallback sang `DemoData` trong backend-backed/release runtime.
- Không tạo password/signup/reset API giả thay cho Google Credential Manager.

## Trình tự tiếp tục đề xuất
1. `git fetch origin --prune`
2. `git checkout frontend/full-stack-runtime-connection`
3. `git pull --ff-only`
4. Đọc `docs/superpowers/specs/2026-09-30-full-stack-runtime-connection-design.md`.
5. Đọc `docs/superpowers/plans/2026-09-30-full-stack-runtime-connection.md`, tiếp tục từ Task 6–9.
6. Compile WIP hiện tại trước khi chỉnh thêm; sửa compile errors bằng contract thật.
7. Hoàn thiện typed mapping + Google auth + session context + scoped reads + Inquiry.
8. Chạy Frontend gate đầy đủ, rồi mới report READY_TO_MERGE.

## Frontend gate bắt buộc
- `gradlew.bat testDebugUnitTest`
- backend-backed variant compile/test khả dụng trong task graph
- `gradlew.bat lintDebug`
- `gradlew.bat assembleDebug`
- `gradlew.bat assembleBackendDebug`
- `gradlew.bat assembleDebugAndroidTest`
- `gradlew.bat bundleRelease`
- trong `web/`: `npm run check`, `npm test`, `npm run test:browser`
- static grep: không `UserRole`, `RoomUi`, `BookingUi`, `SubscriptionPlan`, demo fallback trong backend-backed/release.

Máy coordinator lúc bàn giao có JRE 21 tại `D:\Program Files\CurseForge\Install\java\Jre_21` nhưng không tìm thấy Android SDK chuẩn, nên WIP mới chưa được compile độc lập tại đây.

## Báo cáo khi hoàn tất
```text
BRANCH: frontend/full-stack-runtime-connection
FINAL SHA: <sha>
STAGING SHA CONSUMED: <sha>
OPENAPI SHA/CONTRACT: <sha hoặc blob>
TASKS HOÀN THÀNH: <Task 6/7/8/9>
ANDROID GATES: <command + result>
WEB GATES: <command + result>
FULL-STACK SMOKE: <public listing/auth/session/scoped read/inquiry>
KNOWN GAPS: <explicit>
FILES/AREAS CỐ Ý KHÔNG ĐỤNG: <list>
READY_TO_MERGE: YES/NO
```

Chỉ `READY_TO_MERGE: YES` khi branch chứa staging mới nhất, compile/test bắt buộc GREEN và backend-backed runtime không còn placeholder cho vertical slice đã chọn.
