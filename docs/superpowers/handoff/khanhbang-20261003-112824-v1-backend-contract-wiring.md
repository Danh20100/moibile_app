# Handoff — Khánh Băng — Android V1 backend-contract wiring

## 0. Handoff metadata

- Recipient: `Khánh Băng / frontend owner`
- Repository: `D:\Projects\TroOi-Project`
- Integration branch at handoff start: `integration/full-stack-sync-runtime-staging`
- Verified staging SHA before this handoff commit: `49518926a35c165c7fc58338d87770bb01a24891`
- Backend-unblock integration status: `MERGED_AND_GREEN`
- Backend review record: `docs/superpowers/handoff/reviews/coordinator-20261003-044925-v1-frontend-backend-unblock-review.md`
- Backend contract handoff: `docs/superpowers/handoff/coordinator-20261003-033324-v1-frontend-backend-unblock.md`
- Earlier backend-gap analysis: `docs/superpowers/handoff/duyanh-20261002-231308-backend-api-exposure-gaps.md`

Người nhận phải đọc file này cùng generated contract `docs/api/openapi.json` trước khi sửa Android.

---

## 1. Mục tiêu của phase này

Phase này không phải redesign UI và cũng không phải tạo thêm business rule ở Android.

Mục tiêu là chuyển Android từ trạng thái:

```text
UI đã có nhiều màn hình/flow
+
một số read projection còn placeholder hoặc reconstruction cục bộ
```

sang trạng thái:

```text
Compose/ViewModel
  -> Repository/Gateway
  -> BackendApi/BackendClient
  -> generated backend contract
  -> NestJS authorization/business rules
  -> PostgreSQL source facts/read projections
```

Android chỉ giữ presentation state và command intent.

Android KHÔNG được trở thành source of truth cho:

- Listing lifecycle;
- Room occupancy;
- Tenancy lifecycle;
- Dashboard KPI;
- Deposit state;
- actor/audit provenance;
- Notification business state;
- Payment/Billing/Receipt relationship;
- Search availability semantics;
- user business role.

---

## 2. Source-of-truth order

Trong mọi trường hợp contract/UI hiện tại xung đột với nguồn dưới đây, ưu tiên theo thứ tự:

1. `docs/database/v1/canonical.md`
2. `docs/database/v1/erd` + schema/migrations
3. `docs/contexts`
4. `docs/backlogs/v1`
5. `docs/api/openapi.json`
6. backend implementation/tests
7. Android implementation

Không tự chọn policy cho mục `OPEN`.

Không promote capability `FUTURE`.

---

## 3. User-facing product model phải giữ nguyên

Chỉ có 3 POV user-facing:

```text
Guest
Người thuê
Chủ trọ
```

Không thêm global role như:

```text
USER.role = TENANT
USER.role = LANDLORD
```

Access tiếp tục relationship-derived từ session:

```text
operatedOrganizationIds
linkedTenancyIds
```

`USER != TENANCY_PARTICIPANT`.

Former tenant là lifecycle state/capability, không phải role thứ tư.

---

## 4. Current Android facts phải xử lý

Trên staging hiện tại đã xác nhận các placeholder sau vẫn tồn tại trong backend-backed read path:

```kotlin
operatorListings = emptyList()
dashboardByOrganization = emptyMap()
publicAreaLabel = "Vị trí công khai"
timeline = emptyList()
```

File chính:

`app/src/main/java/com/trooi/app/core/data/BackendTroOiRepository.kt`

UI hiện cũng còn pending copy cho các contract backend giờ đã có, ví dụ:

- Incident event timeline;
- Deposit Application/Deposit lookup;
- tenant History;
- một số landlord read models;
- Search location/availability copy.

Không xóa mọi `V1Pending` một cách máy móc. Chỉ thay pending khi backend authority thực sự tồn tại.

---

## 5. Branch/workflow

Không làm trực tiếp trên `main`.

Khuyến nghị tạo branch mới từ remote staging mới nhất:

```powershell
git fetch origin --prune
git switch integration/full-stack-sync-runtime-staging
git pull --ff-only origin integration/full-stack-sync-runtime-staging
git switch -c frontend/v1-backend-contract-wiring
```

Trước khi bắt đầu:

```powershell
git status --short
git rev-parse HEAD
git rev-parse origin/integration/full-stack-sync-runtime-staging
```

Branch phải bắt đầu từ staging đã chứa merge `4951892` hoặc commit handoff mới hơn của staging.

Không merge worker branch vào nhau.

Không merge vào `main`.

---

# TASK 1 — Android transport + DTO/OpenAPI alignment

## 6.1 Mục tiêu

Đồng bộ Android transport layer với backend OpenAPI hiện tại trước khi sửa repository/UI.

### Files ưu tiên

```text
app/src/main/java/com/trooi/app/core/network/BackendApi.kt
app/src/main/java/com/trooi/app/core/network/BackendClient.kt
app/src/main/java/com/trooi/app/core/network/dto/BackendDtos.kt
app/src/main/java/com/trooi/app/core/network/dto/BackendJsonCodec.kt
app/src/main/java/com/trooi/app/core/network/dto/TransportDocument.kt
app/src/test/...
```

Gateway hiện tại cũng cần audit:

```text
app/src/main/java/com/trooi/app/features/shared/V1ContractGateway.kt
app/src/main/java/com/trooi/app/features/shared/V1RentalGateway.kt
```

## 6.2 Read APIs cần thêm/đồng bộ

### Current Listing by Room

```text
GET /listings?roomId={roomId}
```

Expected behavior:

- authenticated;
- Room operator only;
- returns current non-ARCHIVED Listing;
- `404` nghĩa là Room chưa có current Listing.

Không bắt user nhập Listing ID thủ công.

### Payment history by Tenancy

```text
GET /finance/payments?tenancyId={tenancyId}
```

Không reconstruct Payment list từ Receipt list.

### Incident event timeline

```text
GET /incidents/{incidentId}/events
```

### Notification Center

```text
GET  /notifications
GET  /notifications/{id}
POST /notifications/{id}/read
```

Response có:

```text
sourceType
sourceId
```

### Dashboard

```text
GET /organizations/{organizationId}/dashboard
```

### Deposit

```text
POST /finance/deposits
GET  /finance/deposits?tenancyId={tenancyId}
GET  /finance/deposits/{depositId}/events
POST /finance/deposits/{depositId}/settlements
```

### Former/current authorized rental history

```text
GET /tenancies/{tenancyId}/history
```

### Operator Room operational history

```text
GET /rooms/{roomId}/history
```

### Public spatial Search

```text
GET /listings/public/search
```

Query:

```text
latitude
longitude
radiusMeters
minPrice optional
maxPrice optional
```

Route này là public.

## 6.3 Command contract phải sửa

### Listing publish

```text
POST /listings/{id}/publish
body: none
```

### Listing unpublish

```text
POST /listings/{id}/unpublish
body: none
```

### Listing archive

```text
POST /listings/{id}/archive
body: none
```

### Room manual operational transition

```text
POST /rooms/{id}/operational-state
```

Body chỉ mang requested state hợp lệ:

```json
{ "operationalState": "vacant | maintenance | inactive" }
```

Không gửi:

```text
reasonCode
actorType
actorUserId
trigger
```

Không cho Android gửi `occupied` bằng manual transition.

### Tenancy activation

```text
POST /tenancies/{id}/activate
```

Body:

```json
{ "occurredAt": "ISO timestamp" }
```

### Terms acknowledgement

```text
POST /tenancies/{tenancyId}/terms/{termsId}/acknowledgements
```

Body chỉ:

```text
tenancyParticipantId
acknowledgedAt
```

Không gửi `userId`.

### Tenancy Notice issue

```text
POST /tenancies/{tenancyId}/notices
```

Body:

```text
noticeType
contentOrNote
issuedAt
```

Không gửi `issuedByUserId`.

### Tenancy Notice acknowledge

```text
POST /tenancies/{tenancyId}/notices/{noticeId}/acknowledge
```

Body chỉ:

```text
occurredAt
```

Không gửi `userId`.

## 6.4 Acceptance criteria Task 1

- Android DTO khớp generated OpenAPI;
- removed provenance/user-ID fields không còn xuất hiện trong request model;
- Room operational command dùng `POST`, không còn `PATCH`;
- public search gọi unauthenticated;
- protected routes dùng existing authenticated client/token path;
- codec tests cover nullable fields và arrays;
- malformed/unknown enum handling vẫn explicit, không silently default.

Suggested commit:

```text
feat(android): align v1 backend transport contracts
```

---

# TASK 2 — BackendTroOiRepository authoritative read wiring

## 7.1 Mục tiêu

Loại bỏ read placeholder/reconstruction mà backend giờ đã cung cấp authoritative contract.

Primary file:

`app/src/main/java/com/trooi/app/core/data/BackendTroOiRepository.kt`

Related models:

```text
core/model/FeatureProjections.kt
core/model/FrontendReadSnapshot.kt
core/model/Models.kt
```

## 7.2 operatorListings

Hiện tại:

```kotlin
operatorListings = emptyList()
```

Phải thay bằng:

- iterate authorized operated Rooms;
- `GET /listings?roomId={roomId}`;
- map `404` thành `no current listing for this room`, không phải generic fatal error;
- map Listing server lifecycle vào `OperatorListingCard`;
- không suy ra Listing state từ Room state.

Không N+1 optimize bằng cách bỏ authorization hoặc query all Listings globally.

MVP hiện tại chấp nhận scoped per-Room query.

## 7.3 Payment history

Hiện repository đi qua global Receipt list rồi `getPayment(receipt.paymentId)`.

Phải chuyển tenant/operator Payment history sang:

```text
GET /finance/payments?tenancyId=...
```

Receipt vẫn là evidence riêng.

Không xem Receipt là Payment truth.

## 7.4 Incident timeline

Hiện tại:

```kotlin
timeline = emptyList()
```

Phải map từ:

```text
GET /incidents/{id}/events
```

Preserve backend event order.

Không tạo synthetic event từ current Incident status.

## 7.5 Dashboard

Hiện tại:

```kotlin
dashboardByOrganization = emptyMap()
```

Phải load:

```text
GET /organizations/{organizationId}/dashboard
```

Map tối thiểu:

```text
roomsByState
activeTenancyCount
openIncidentCount
outstandingReceivable
confirmedPaymentTotal
```

Hai finance aggregate có thể `null`.

Nếu `null`, UI phải biểu diễn `chưa có authoritative aggregate` hoặc hide metric.

KHÔNG tự cộng Charges/Payments ở Android để điền số.

## 7.6 Deposit

`DepositCard` hiện tồn tại ở frontend model nhưng backend-backed repository chưa authoritative.

Phải map:

```text
requirementAmount
fundedAmount
settledAmount
heldAmount
state
blockedByOpenPolicy
```

Nếu:

```text
blockedByOpenPolicy = true
```

UI không được tự chọn requirement/state.

Không derive state bằng local arithmetic.

## 7.7 Notification

Map Notification Center từ backend.

Không infer navigation từ human message.

Use:

```text
sourceType
sourceId
```

Nhưng navigation phải defensive:

- known sourceType -> route tương ứng;
- unknown sourceType -> Notification detail/fallback;
- không crash;
- read-state update không mutate source business record.

## 7.8 History

Tenant/current/former history:

```text
GET /tenancies/{id}/history
```

Operator Room history:

```text
GET /rooms/{id}/history
```

Không rebuild lịch sử bằng cách gom random local lists khi read-model đã có.

## 7.9 Acceptance criteria Task 2

Không còn:

```kotlin
operatorListings = emptyList()
dashboardByOrganization = emptyMap()
timeline = emptyList()
```

trong backend-backed read path, trừ khi empty là legitimate server result.

Repository tests phải chứng minh:

- empty server collection != transport failure;
- 404 current Listing handled as no Listing;
- nullable Dashboard finance aggregates preserved;
- Deposit blockedByOpenPolicy preserved;
- former-rental history readable;
- unrelated data không bị merge chéo giữa Tenancy/Organization/Room.

Suggested commit:

```text
feat(android): wire authoritative v1 read projections
```

---

# TASK 3 — Discovery/Search + Listing operator wiring

## 8.1 Public Search/Map

Use:

```text
GET /listings/public/search
```

Android có thể gửi:

```text
latitude
longitude
radiusMeters
minPrice
maxPrice
```

Response chỉ chứa public projection.

Không dùng exact operational Property location.

Không lấy operational address từ operator APIs rồi reuse cho Guest.

## 8.2 `publicAreaLabel` placeholder

Hiện Android có:

```kotlin
publicAreaLabel = "Vị trí công khai"
```

Đây không phải authoritative area label.

Không đổi thành hardcoded `Thủ Đức`, `Quận 9`, ward, district, v.v.

Cho tới khi textual area/geocoder authority được freeze:

- UI có thể dùng generic copy không giả là địa danh;
- hoặc ưu tiên map/distance presentation;
- không expose operational address.

## 8.3 Availability

UI hiện ghi Search khu vực/Availability chưa có backend contract.

Backend hiện có frozen invariant:

```text
PUBLISHED Listing -> Room VACANT
```

nhưng chưa có independent Availability vocabulary/query semantics.

Không tạo:

```text
AVAILABLE
UNAVAILABLE
availableFromDate
future calendar
```

nếu Canonical chưa freeze.

Giữ Availability control disabled/blocked hoặc bỏ khỏi V1 interaction.

## 8.4 Listing operator UX

Room detail/operator inventory phải discover current Listing qua Room ID.

Không yêu cầu user nhập Listing UUID.

Publish/unpublish/archive dùng simplified server-owned commands.

## 8.5 Acceptance criteria Task 3

- Search radius + price chạy backend-backed;
- public Search không cần auth;
- no private location leakage;
- operator Room -> current Listing hoạt động không manual ID;
- publish/unpublish/archive không gửi audit metadata;
- textual area/Availability/type không được fake complete.

Suggested commit:

```text
feat(android): wire discovery and operator listings
```

---

# TASK 4 — Finance + Deposit + Incident + Notification

## 9.1 Tenant finance

Giữ phân biệt:

```text
Billing Cycle / Charge = obligation
Payment = actual inflow
PaymentAllocation = allocation
DepositPaymentApplication = deposit funding application
Receipt = evidence
Deposit = deposit lifecycle
```

Không merge các concept vào một `paid` boolean.

## 9.2 Deposit screen

Display server projection.

Recommended UI states:

```text
no deposit lifecycle -> empty/not initialized
EXPECTED
PARTIALLY_HELD
HELD
PENDING_SETTLEMENT
SETTLED
blockedByOpenPolicy -> explicit unavailable/policy pending state
```

Không tự tính state.

## 9.3 Incident detail

Replace pending timeline bằng server Incident Events.

Current status vẫn lấy Incident source record.

Timeline là history, không dùng timeline để overwrite current Incident state.

## 9.4 Notification Center

Implement:

- list;
- detail;
- mark read;
- source navigation;
- empty/error/loading states.

Không invent push-channel behavior. Delivery channel vẫn OPEN.

## 9.5 Acceptance criteria Task 4

- Payment list không phụ thuộc Receipt discovery;
- Deposit UI xử lý nullable/open-policy projection;
- Incident timeline server-backed;
- Notification list/detail/read server-backed;
- no source/business mutation từ Notification;
- actor identity không lấy từ client text field.

Suggested commit:

```text
feat(android): wire finance incidents and notifications
```

---

# TASK 5 — Dashboard + Rental History + Room Operational History UI

## 10.1 Landlord Dashboard

Use Dashboard endpoint.

Không tính KPI authoritative trong Compose/ViewModel.

Recommended rendering:

```text
Rooms by state        -> server
Active tenancies      -> server
Open incidents        -> server
Outstanding receivable -> nullable
Confirmed payment total -> nullable
```

## 10.2 Tenant History

`TenantFlow.kt` hiện đã có concept former rental history.

Use:

```text
GET /tenancies/{id}/history
```

Render from server projection:

- tenancy lifecycle;
- terms versions;
- payment + receipts;
- notices;
- incidents + events;
- deposit + events.

Former tenant history phải read-only.

Không show operational write buttons cho ENDED historical tenancy.

## 10.3 Landlord Room History

Use:

```text
GET /rooms/{id}/history
```

Render source-backed history:

- Listing records/status events;
- Tenancies;
- Billing cycles;
- Payments/Receipts;
- Deposit;
- Incidents/events.

Không tạo một local duplicated business history database.

## 10.4 Acceptance criteria Task 5

- Dashboard no longer empty placeholder;
- former/current tenant can open authorized rental history;
- former tenant has no operational mutations;
- operator can open Room operational history;
- unrelated user history cannot appear due to local cache merging;
- nullable/open-policy fields have explicit presentation.

Suggested commit:

```text
feat(android): surface v1 dashboard and history
```

---

# TASK 6 — Android regression + real backend E2E closure

## 11.1 Unit/build gates

At minimum:

```powershell
$env:JAVA_HOME='D:\Program Files\Android\Android Studio\jbr'
$env:Path="$env:JAVA_HOME\bin;$env:Path"

.\gradlew.bat :app:testDebugUnitTest --console=plain
.\gradlew.bat :app:assembleDebug --console=plain
.\gradlew.bat :app:assembleBackendDebug -PtrooiApiBaseUrl=http://10.0.2.2:3000/ --console=plain
```

Run lint appropriate to current project gate as well.

Do not treat `assembleBackendDebug` as runtime E2E proof.

## 11.2 Backend contract verification

Before emulator E2E, root backend should remain green:

```text
pnpm typecheck
pnpm lint
pnpm openapi:generate
pnpm e2e:coverage
pnpm test
pnpm test:conformance:database-v1
pnpm build
git diff --check
```

Do not silently change backend semantics from the frontend branch unless a real contract defect is found and escalated.

## 11.3 Emulator/backendDebug journeys

Run with Pixel 8 emulator and backend-backed APK.

Priority journeys:

### Guest

```text
Public Search
-> Listing detail
-> Inquiry
```

Evidence should prove:

- search result from HTTP backend;
- public coordinates only;
- Inquiry POST success;
- no Booking/Reservation semantics.

### Landlord Listing

```text
Organization
-> Property
-> Room
-> current Listing discovery
-> publish/unpublish/archive legal action
```

### Tenant Finance

```text
Linked Tenancy
-> Payment history
-> Receipt evidence
-> Deposit projection/events
```

### Incident

```text
Incident list
-> Incident detail
-> event timeline
```

### Dashboard

```text
Organization
-> Dashboard projection
```

### Notification

```text
Notification list
-> detail/read
-> source navigation
```

### History

```text
Tenant/former tenant -> tenancy history
Operator -> Room history
```

## 11.4 E2E evidence standard

Do not mark a write proven from snackbar/HTTP 2xx alone.

For important executable write flows target evidence chain:

```text
Android action
-> authenticated HTTP
-> NestJS authorization
-> PostgreSQL source fact
-> Notification/read-model side effect where applicable
-> authorized read/UI
-> invariant assertion
```

Static flow catalog != live E2E.

MockWebServer != real-backend E2E.

APK build != runtime E2E.

## 11.5 Google auth

Authenticated Phase C requires real Google Web Client ID and emulator Google session/account.

Never:

- bypass AuthGuard;
- inject arbitrary bearer token;
- invent Google credentials;
- add test-only auth bypass to production code.

If real Google credential/session is unavailable, report the gate as blocked, not passed.

Suggested final test/report commit:

```text
test(android): close v1 backend contract wiring
```

---

## 12. Known authority blockers — DO NOT solve locally

### Textual public area/geocoder

Backend supports coordinate/radius Search.

Backend does NOT yet freeze authoritative textual area/geocoder semantics.

Do not invent area label.

### Independent Availability vocabulary

Do not create independent Availability enum/date/calendar semantics.

### Room/property type

Owner/vocabulary remains OPEN.

### Nested Terms object schemas

These remain opaque structured facts:

```text
billingDayOrDueDateRule
electricityArrangement
waterArrangement
minimalRentalConditions
```

Do not create Android enums/inner schema and pretend they are authoritative.

### Dashboard finance totals

`outstandingReceivable` and `confirmedPaymentTotal` may remain `null`.

Do not compute replacements client-side.

### Deposit requirement change after partial funding

When backend says:

```text
blockedByOpenPolicy = true
```

do not resolve it locally.

### Notification delivery channels

Do not freeze PUSH/SMS/Zalo/email behavior here.

---

## 13. Explicit FUTURE exclusions

Do not pull these into this frontend phase:

- subscription/quota;
- CSV/Excel import;
- advanced staff/delegation;
- room asset inventory;
- Service/WiFi/Parking/Other charge categories;
- service marketplace/dispatch;
- AI/OCR/predictive features;
- realtime chat;
- saved search/advanced favorites;
- OTA booking/reservation;
- nightly calendar;
- dynamic pricing/proration;
- public tenant/personal-landlord rating.

---

## 14. Test coverage expectations by layer

### Transport/codec

Test:

- new response DTO decoding;
- nullable values;
- arrays;
- sourceType/sourceId;
- Deposit blockedByOpenPolicy;
- Dashboard nullable finance totals;
- History nested projection.

### Repository mapping

Test:

- Room current Listing 200 and 404;
- no cross-organization mixing;
- Payment direct read;
- Incident timeline;
- Deposit projection;
- Notification source navigation fields;
- Dashboard mapping;
- tenant history;
- Room history.

### ViewModel/state

Test:

- loading;
- empty;
- authorized data;
- backend error;
- nullable/Open-policy state;
- former-tenant read-only.

### Compose/UI

Test stable semantics/testTags where needed for Maestro.

Do not couple test selectors to Vietnamese visible copy when a stable semantic ID can be used.

---

## 15. Suggested commit sequence

Keep changes reviewable. Recommended:

```text
1. feat(android): align v1 backend transport contracts
2. feat(android): wire authoritative v1 read projections
3. feat(android): wire discovery and operator listings
4. feat(android): wire finance incidents and notifications
5. feat(android): surface v1 dashboard and history
6. test(android): close v1 backend contract wiring
7. docs(android): hand off completed v1 backend wiring
```

Do not make one giant commit unless there is a strong technical reason.

---

## 16. Files likely to change

Core:

```text
app/src/main/java/com/trooi/app/core/data/BackendTroOiRepository.kt
app/src/main/java/com/trooi/app/core/data/TroOiRepository.kt
app/src/main/java/com/trooi/app/core/model/FeatureProjections.kt
app/src/main/java/com/trooi/app/core/model/FrontendReadSnapshot.kt
app/src/main/java/com/trooi/app/core/model/Models.kt
app/src/main/java/com/trooi/app/core/network/BackendApi.kt
app/src/main/java/com/trooi/app/core/network/BackendClient.kt
app/src/main/java/com/trooi/app/core/network/dto/BackendDtos.kt
app/src/main/java/com/trooi/app/core/network/dto/BackendJsonCodec.kt
```

Feature gateways/ViewModels:

```text
app/src/main/java/com/trooi/app/features/shared/V1ContractGateway.kt
app/src/main/java/com/trooi/app/features/shared/V1RentalGateway.kt
app/src/main/java/com/trooi/app/features/organization/OperatorViewModel.kt
app/src/main/java/com/trooi/app/features/tenancy/RentalViewModel.kt
```

UI candidates:

```text
app/src/main/java/com/trooi/app/features/discovery/PublicDiscoveryFilters.kt
app/src/main/java/com/trooi/app/features/landlord/LandlordScreens.kt
app/src/main/java/com/trooi/app/features/organization/OperatorWorkspace.kt
app/src/main/java/com/trooi/app/features/tenancy/RentalWorkspace.kt
app/src/main/java/com/trooi/app/features/tenant/TenantFlow.kt
app/src/main/java/com/trooi/app/features/tenant/TenantScreens.kt
```

This is a candidate list, not permission to modify every file.

---

## 17. Definition of done

Frontend backend-contract wiring is DONE only when all conditions below are true:

### Contract

- Android request/response models match current OpenAPI;
- no stale client-authoritative provenance/user-ID request fields;
- current Listing is discoverable by Room;
- Payment history uses Tenancy endpoint;
- Incident timeline uses IncidentEvent API;
- Dashboard uses backend projection;
- Deposit uses backend projection/events;
- Notifications use backend list/detail/read + source fields;
- rental and Room history use server read models;
- Search radius/price uses public backend search.

### Authority

- no private operational location in Guest Search;
- no global user business role;
- no client-derived Deposit state;
- no client-derived Dashboard financial totals;
- no fabricated Availability/type/area policy;
- OPEN/FUTURE remain OPEN/FUTURE.

### Android quality

- backend-backed unit tests green;
- Debug build green;
- BackendDebug build green;
- lint green;
- stable test selectors preserved;
- no production mock/test code.

### Runtime

- backend-backed emulator journeys executed where credentials permit;
- authenticated flows use real Google auth;
- known blocked gates documented precisely;
- no claim of full E2E from static/unit/build-only evidence.

---

## 18. Final handoff expected from Băng

When Băng finishes, create a NEW timestamped handoff in:

```text
docs/superpowers/handoff/
```

Suggested filename:

```text
khanhbang-<YYYYMMDD-HHmmss>-v1-backend-contract-wiring-complete.md
```

Must include:

- branch;
- exact HEAD SHA;
- staging base SHA;
- commits;
- files/surfaces changed;
- contracts consumed;
- placeholders removed;
- remaining intentional pending states;
- Android unit/build/lint results;
- emulator/backendDebug results;
- authenticated Google E2E result or explicit blocker;
- DISC/CX journey evidence actually executed;
- OPEN/FUTURE blockers still untouched;
- `READY_TO_REVIEW: YES|NO`.

Do not write `READY_TO_REVIEW: YES` if real required gates are still failing.

---

## 19. Immediate first action for Băng

Start with Task 1 only.

Before changing UI:

1. branch from latest staging;
2. diff current Android transport against `docs/api/openapi.json`;
3. enumerate missing DTO/API methods;
4. update transport + codec tests;
5. verify request bodies no longer send server-owned actor/provenance;
6. commit Task 1;
7. only then proceed to repository wiring.

Do not start by visually removing `V1Pending` messages.
