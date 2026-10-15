# Handoff — KhanhBang — Full-stack Runtime Connection

**Vai trò:** Android Frontend runtime integration
**Branch:** `frontend/full-stack-runtime-connection`
**Nguồn branch:** `frontend/backlog-v1-reconciliation@b3c14af`, sau đó merge staging mới nhất.
**Không merge staging trực tiếp.**

## Đọc trước khi làm

1. `docs/superpowers/specs/2026-09-30-full-stack-runtime-connection-design.md`
2. `docs/superpowers/plans/2026-09-30-full-stack-runtime-connection.md`
3. `docs/api/openapi.json` sau Backend contract gate.
4. `app/docs/api-dependencies-v1.md`
5. `docs/backlogs/v1/` theo feature đang nối.

## Tình trạng đầu vào

Frontend reconcile `b3c14af` đã xử lý model/UI cũ và đang `READY_TO_MERGE: NO` đúng vì Release chưa nối Backend.
Backend+Database đã vào staging; Backend support sẽ harden auth/OpenAPI trước khi DTO mapping production.
## P0 — branch sync

Fetch remote, checkout `frontend/full-stack-runtime-connection`, pull latest và merge `origin/integration/full-stack-sync-runtime-staging`.
Không rebase/force-push.

Nếu staging có Backend support commit mới trong lúc đang làm, merge staging lại trước khi map contract mới.

## P0 — transport foundation

Thêm HTTP transport chuẩn cho Android:

- base URL từ BuildConfig/environment;
- bearer token provider/interceptor;
- transport DTO tách khỏi UI projection;
- backend-backed debuggable variant để smoke test;
- error/auth-expired mapping rõ.

Có thể làm transport skeleton song song lúc Duy Anh hoàn thiện OpenAPI, nhưng không đoán DTO field chưa publish.
## P0 — auth production flow

Backend phase này hỗ trợ Google ID Token, không có password/signup/reset contract.

Production/backend-backed flow phải:

1. lấy Google ID Token bằng Credential Manager;
2. gọi `POST /identity-access/auth/google`;
3. dùng cùng token làm Bearer cho protected request;
4. gọi `GET /identity-access/me`;
5. map `operatedOrganizationIds` và `linkedTenancyIds` vào `AccessCapabilities`.

Ẩn/bỏ password signup/reset khỏi production flow. Không invent endpoint.
Logout phải clear token/session context.

## P1 — vertical slices

Nối theo thứ tự:

1. `GET /listings/public` → Public Discovery.
2. Google auth + `/identity-access/me`.
3. Organization → Property → Room scoped reads.
4. linked Tenancy → Terms/Notices/Finance/Receipt reads.
5. `POST /inquiries` contact intent.

## Không được regression

- không đưa `UserRole`, `RoomUi`, `BookingUi`, `SubscriptionPlan` trở lại active Android;
- không dùng exact operational address cho public Listing;
- không tự tính Payment/Deposit/Receipt truth từ Room/debt;
- không generic `completeTicket()` làm Incident transition;
- không bật legacy web product SPA;
- không fallback sang DemoData khi backend-backed production request lỗi.

## Khi Backend thiếu contract

Không sửa `src/**` hoặc `database/**` trên branch Frontend.

Report cho Duy Anh theo format:

```text
ENDPOINT/OPERATION
CURRENT OPENAPI
EXPECTED CLIENT NEED
BACKLOG/CANONICAL BASIS
BLOCKING SCREEN/FLOW
```

Duy Anh sửa branch support → GREEN → merge staging. Sau đó fetch/merge staging vào branch Frontend rồi tiếp tục.
## Verification trước khi báo done

Android:

```text
./gradlew.bat testDebugUnitTest
./gradlew.bat lintDebug
assemble debug/backend-backed debug
assembleDebugAndroidTest
bundleRelease
```

Web:

```text
npm run check
npm test
npm run test:browser
```

Nếu có device/emulator, smoke Google auth, public discovery, protected scoped read và Inquiry.

## Report cuối

```text
FINAL SHA
STAGING SHA đã sync
OPENAPI SHA/contract used
ANDROID TEST/BUILD RESULT
WEB RESULT
RUNTIME SMOKE RESULT
UNRESOLVED BACKEND GAPS
KNOWN DEVICE/ENV LIMITATIONS
READY_TO_MERGE: YES/NO
```

Không tự merge vào staging.