# Đặc tả kết nối runtime Frontend ↔ Backend ↔ Database

**Trạng thái:** ĐÃ CHỐT ĐỂ HANDOFF
**Ngày:** 2026-09-30
**Repository:** `onsra520/TroOi-Project`
**Staging sau Gate 1:** `integration/full-stack-sync-runtime-staging@c4a28c8`
**Frontend đã reconcile:** `frontend/backlog-v1-reconciliation@b3c14af`

## 1. Mục tiêu

Hoàn tất đường chạy thật của TrọƠi theo kiến trúc:

```text
Android App
    ↓ HTTP / OpenAPI
NestJS Backend
    ↓ repository / transaction
PostgreSQL/PostGIS
```

Frontend tuyệt đối không truy cập Database trực tiếp. Website tiếp tục là marketing-only.
Mục tiêu của phase này không phải mở thêm feature FUTURE, mà nối các capability CURRENT đã có contract thành những vertical slice chạy thật và có bằng chứng test.
## 2. Source of truth

Khi có mâu thuẫn, ưu tiên theo thứ tự:

1. `docs/database/v1/canonical.md`.
2. `docs/database/v1/erd/` và schema Database v1.
3. `docs/contexts/`.
4. `docs/backlogs/v1/`.
5. `docs/api/openapi.json` sau khi contract-readiness gate của phase này GREEN.
6. Code/test hiện tại.

Không dùng code legacy để thay đổi Canonical. Không đưa Subscription/Pricing/Quota, CSV/Excel import, booking/reservation hoặc realtime chat vào CURRENT.

## 3. Baseline đã xác minh

Backend + Database đã được merge vào staging bằng merge commit `c4a28c8` với parent Backend `31eb586`.
Gate Backend/Database tại `31eb586` đã GREEN trên GitHub Actions: typecheck, core, database validators, PostgreSQL provision, migration, seed, migration parity, domain contract và full repository suite.

Frontend reconcile tại `b3c14af` đã bỏ global role, RoomUi god-model, Subscription CURRENT, Booking/Chat active surface và finance derivation cũ. Web production entry đã marketing-only.
## 4. Finding bắt buộc xử lý trước khi nối Android Release

`docs/api/openapi.json` hiện chưa đủ để làm client contract hoàn chỉnh:

- `components.schemas` đang rỗng;
- đa số business endpoint không công bố request-body schema;
- đa số response không công bố JSON schema;
- bearer security scheme có tồn tại nhưng chưa được áp vào protected operation trong document.

Ngoài ra `AuthGuard` hiện chỉ kiểm tra header có chuỗi `Bearer ...`, chưa xác minh token. Vì vậy arbitrary non-empty bearer có thể vượt qua lớp authentication hiện tại.

Backend hiện chỉ có cơ chế Google ID Token thật ở `POST /identity-access/auth/google`. Frontend reconcile vẫn còn form email/phone + password, signup và password reset nhưng Backend không có các contract tương ứng. Frontend không được invent các API này.
## 5. Quyết định auth cho phase này

Không tạo một hệ thống session/JWT riêng trong phase kết nối này.

Android dùng Google Credential Manager để lấy Google ID Token. Token này được:

1. gửi vào `POST /identity-access/auth/google` để Backend ensure USER và trả principal;
2. dùng làm Bearer token cho protected request;
3. được Backend xác minh thật ở `AuthGuard` trước khi request đi tiếp.

Backend phải attach principal đã verify vào request context. Protected route không được chỉ kiểm tra token có tồn tại.

Frontend phải bỏ/ẩn khỏi production flow các form password/signup/reset chưa có Backend contract. Debug preview có thể giữ fixture riêng nhưng không được giả là production auth.
## 6. Session context và capability contract

Frontend không được tự suy ra owner/tenant authority từ dữ liệu màn hình.
Backend cần một read contract cho authenticated user, ưu tiên:

`GET /identity-access/me`

Response tối thiểu:

```text
userId
operatedOrganizationIds[]
linkedTenancyIds[]
```

Thông tin hiển thị như `name`, `email`, `pictureUrl` có thể trả thêm nếu lấy được từ verified principal, nhưng không trở thành business authority.

`operatedOrganizationIds` phải đến từ ownership/relationship thật. `linkedTenancyIds` phải đến từ Participant ↔ User link thật. Không thêm global `LANDLORD | TENANT` role.
## 7. Contract-readiness gate của Backend

Trước khi Băng map DTO production, Duy Anh phải làm `docs/api/openapi.json` đủ máy đọc được cho các endpoint phase này:

- request body có schema;
- response success có schema;
- path/query parameter có type;
- protected operation khai báo bearer security;
- `@Public()` operation không yêu cầu bearer;
- schema name ổn định, không dùng anonymous object khó map;
- `openapi:generate` deterministic và `git diff --exit-code docs/api/openapi.json` sạch sau generate.

Các sửa đổi này chỉ mô tả contract đang tồn tại hoặc bổ sung read endpoint cần cho client; không được làm thay đổi lifecycle/invariant chỉ để thuận tiện cho Frontend.

## 8. Vertical slices phải chạy thật

Phase này ưu tiên chứng minh đường xuyên ba layer bằng các slice sau:

1. **Public Discovery:** Android → `GET /listings/public` → Listing repository → PostgreSQL.
2. **Google Authentication:** Credential Manager → Backend verify → USER persistence → session context.
3. **Relationship Context:** Android → `GET /identity-access/me` → Organization/Tenancy relationships → PostgreSQL.
4. **Operator Read:** Organization → Property → Room → Incident/finance reads trong đúng scope.
5. **Tenant Read:** linked Tenancy → Terms/Notices/Finance/Receipt reads trong đúng scope.
6. **Inquiry Write:** Android gửi contact intent cho Listing PUBLISHED; không biến thành booking.
## 9. Dashboard và các surface chưa có contract đủ

Dashboard chỉ được render từ read model Backend. Nếu Backend chưa có dashboard endpoint đủ semantics, Frontend phải hiển thị pending/empty state thay vì tự tính lại từ Room/finance local.

Các capability CURRENT khác chưa có contract client-ready được xử lý theo cùng nguyên tắc: hoặc Duy Anh bổ sung read/action contract rõ ràng trên branch Backend support, hoặc Frontend giữ trạng thái chưa khả dụng. Không dùng fixture production để lấp gap.

## 10. Android transport

Băng được phép thêm HTTP client chuẩn cho Android, ưu tiên Retrofit + OkHttp hoặc một stack tương đương đã pin version.

Yêu cầu:

- Base URL lấy từ BuildConfig/environment, không hardcode production host;
- Bearer token được gắn bằng interceptor/auth provider;
- DTO transport tách khỏi `FrontendReadSnapshot` và UI projection;
- mapping transport → projection có unit test;
- network/error/auth-expired được map thành trạng thái UI rõ;
- debug fixture vẫn được phân biệt rõ với backend-backed build;
- phải có một build variant debuggable dùng Backend thật để smoke test, không phụ thuộc unsigned Release APK.
## 11. Branch topology cho phase kết nối

Không tiếp tục viết trực tiếp lên hai branch đã hoàn thành Gate 1.

```text
integration/full-stack-sync-runtime-staging
├── backend/full-stack-contract-support
└── frontend/full-stack-runtime-connection
```

- `backend/full-stack-contract-support` tạo từ staging sau coordination-doc commit; Duy Anh sở hữu Backend/OpenAPI/auth fixes.
- `frontend/full-stack-runtime-connection` tạo từ `frontend/backlog-v1-reconciliation@b3c14af`, sau đó merge staging mới vào; Băng sở hữu Android integration.

Hai người không commit trực tiếp vào staging.

Nếu Băng phát hiện Backend contract gap, Băng ghi rõ endpoint/schema/expected behavior và dừng workaround. Duy Anh sửa trên Backend support branch, test GREEN, merge về staging; Băng fetch + merge staging vào Frontend branch rồi tiếp tục.
## 12. Merge protocol

Thứ tự bắt buộc:

1. Duy Anh làm Backend contract-readiness/auth trên branch support và đưa gate về GREEN.
2. Merge Backend support vào staging.
3. Băng merge staging mới vào Frontend runtime branch.
4. Băng map client theo OpenAPI đã publish và chạy Android/Web gate.
5. Nếu có contract gap mới, lặp lại vòng Backend support → staging → Frontend sync.
6. Khi Frontend GREEN trên staging mới nhất, merge Frontend runtime branch vào staging.
7. Chạy final full-stack smoke trên staging sau merge.

Không merge Frontend vào staging khi Release/backend-backed variant vẫn còn `backendUnavailable()` cho các flow được chọn làm vertical slice.

## 13. Điều kiện hoàn thành

- arbitrary bearer token bị từ chối;
- Google ID Token hợp lệ tạo/resolve USER và dùng được cho protected request;
- `/identity-access/me` trả relationship context thật;
- OpenAPI có schema và security đủ cho các endpoint được consume;
- Android public discovery đọc dữ liệu PostgreSQL thật qua Backend;
- ít nhất một protected read và Inquiry write chạy xuyên Android → Backend → Database;
- production/release path không dùng demo fixture làm business truth;
- web vẫn marketing-only;
- Backend/DB CI GREEN và Frontend build/test GREEN trên exact SHA merge;
- final staging không có conflict, dirty generated OpenAPI hoặc hidden mock workaround.
## 14. STOP conditions

Dừng và báo coordinator thay vì tự quyết khi:

- cần invent password/signup/reset API hoặc custom session JWT mới;
- cần thay Canonical/lifecycle/cardinality để làm client dễ hơn;
- cần expose operational exact address qua public Listing;
- cần suy capability từ UI/local state thay vì relationship thật;
- cần biến Inquiry thành booking/reservation/chat;
- cần dùng Subscription/Quota để gate CURRENT capability;
- cần cho Frontend truy cập Database trực tiếp;
- cần bypass auth/authorization chỉ để smoke test pass;
- OpenAPI và runtime behavior không khớp nhau;
- một endpoint CURRENT cần policy đang `OPEN` nhưng chưa có owner decision.
