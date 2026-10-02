# Handoff — V1 E2E Flow Closure cho Duy Anh

## 1. Trạng thái bàn giao

- Owner tiếp theo: **Duy Anh**.
- Repo: `onsra520/TroOi-Project`.
- Base branch: `integration/full-stack-sync-runtime-staging`.
- Base SHA tại thời điểm handoff: `5b639439b50fa72f7e37b7bd4af23b722235e466`.
- Working branch dành cho task này: `backend/v1-e2e-flow-closure`.
- Không merge vào `main`.
- Không force-push/rebase lịch sử chung.
- Không sửa/xóa local WIP của coordinator:
  - `gradle.properties`
  - `gradle/gradle-daemon-jvm.properties`

## 2. Mục tiêu

Đóng các khoảng trống implementation + integration để bộ V1 flow có thể được kiểm thử theo hành vi người dùng thật, xuyên suốt:

```text
Android
→ HTTP/OpenAPI
→ NestJS
→ PostgreSQL/PostGIS
→ business event
→ notification/read model khi applicable
→ actor còn lại nhìn thấy đúng source feature
```

Không chỉ kiểm tra API trả 2xx. Mỗi business flow phải được chứng minh theo bốn lớp:

1. **UI/Client** — người dùng thấy đúng kết quả/thao tác.
2. **HTTP/API** — endpoint/status/contract đúng.
3. **Database** — source fact đúng và provenance đúng.
4. **Invariant / cross-actor** — không có side effect sai; actor khác nhận/đọc đúng dữ liệu khi V1 yêu cầu.

## 3. Authority bắt buộc

Đọc theo thứ tự:

1. `docs/database/v1/canonical.md`
2. `docs/database/v1/erd*` + schema/migrations V1
3. `docs/contexts/`
4. `docs/backlogs/v1/`
5. stable OpenAPI
6. code/tests

Không được chỉnh Canonical hoặc invent policy chỉ để test pass.

### Ranh giới quan trọng

- `USER != TENANCY_PARTICIPANT`
- Không global `USER.role = LANDLORD/TENANT`.
- Listing: `DRAFT | PUBLISHED | UNPUBLISHED | ARCHIVED`.
- Tenancy: `DRAFT | ACTIVE | ENDING | ENDED | CANCELLED`; **không ACTIVE -> ENDED trực tiếp**.
- Search/Map chỉ đọc `PUBLISHED Listing`.
- `Inquiry != Booking`.
- Inquiry **không phải** prerequisite của Tenancy.
- Max 1 current non-archived Listing / Room.
- Max 1 non-terminal Tenancy / Room.
- Dashboard/History/Notification là projection/delivery, không phải business source of truth.
- Notification **không mutate business state**.
- Payment Claim != Payment; Billing != Payment; Receipt != Payment.
- Exact notification channels vẫn **OPEN**.
- OTA reservation / instant booking là **FUTURE**, không kéo vào V1.

## 4. Test inventory đã có

Static coverage hiện tại:

```text
83 atomic flows
198 test cases
24 V1 backlog files
8 frozen Notification use cases
```

Chạy:

```powershell
pnpm e2e:coverage
```

Kỳ vọng:

```text
V1 E2E coverage PASS:
83 atomic flows, 198 cases, 24 backlog files, 8 frozen notification use cases
```

Các nguồn:

```text
tests/e2e/flow-catalog.yaml
tests/e2e/flows/
tests/e2e/cases/
tests/e2e/journeys/
tests/e2e/journeys/CX-v1-cross-actor.yaml
tests/e2e/assertions/
```

## 5. Trạng thái executable hiện tại

### DISC-01 — Public Listing Feed

`pnpm e2e:flow DISC-01`

Đã GREEN với:

- deterministic reset/seed;
- Android backendDebug;
- Maestro;
- public Listing UI assertion;
- HTTP assertion;
- PostgreSQL assertion;
- privacy/invariant assertion.

### DISC-02 — Listing Detail

Đã có automation nhưng hiện **FLAKY/FAIL trên Windows** tại navigation tap.

Observed failure:

```text
Tap on "Phong E2E - Thu Duc"
→ Maestro exits 1
```

Debug cho thấy title TextView là `clickable=false`; clickable nằm trên parent Listing card. Đồng thời Maestro Windows từng log heartbeat/file-lock issue.

Không được đánh dấu DISC-02 GREEN cho tới khi chạy lặp lại ổn định.

Hướng fix ưu tiên:

- target stable semantic/test tag trên clickable Listing card, không tap TextView title;
- tránh coordinate tap;
- giữ Android behavior không đổi;
- verify nhiều lượt liên tiếp.

## 6. Cross-actor behavior phải đóng

Đây là phần quan trọng của handoff.

### CX-01 — Searcher → Inquiry → Operator

V1 semantics:

```text
Searcher mở PUBLISHED Listing
→ "Tôi quan tâm / Liên hệ"
→ POST Inquiry
→ Inquiry persisted
→ Notification cho primary owner/operator của Listing
→ operator mở Notification
→ mở đúng Inquiry
```

Phải chứng minh:

- Inquiry thuộc đúng Listing.
- sender lấy từ authenticated principal, không từ authority do client tự gửi.
- recipient thực sự operate Listing.
- Notification reference trỏ về đúng Inquiry/source.
- không tạo Booking/Reservation.
- không tạo Tenancy.
- không đổi Room state.
- không tự unpublish Listing.

**Gap hiện tại:** `InquiryService.create()` đang persist Inquiry nhưng chưa tạo Notification side effect.

### CX-02 — Tenant Incident → Operator → Tenant

```text
tenant report Incident
→ REPORTED + first IncidentEvent
→ notify operator
→ operator ACKNOWLEDGED/IN_PROGRESS/RESOLVED...
→ append event mỗi transition
→ notify affected authorized user
→ user mở lại source Incident
```

Notification không được tự transition Incident.

### CX-03 — Billing Due → Confirmed Payment

```text
Billing Cycle/Charge
→ due condition
→ notify linked tenant
→ tenant mở Billing
→ operator records confirmed Payment
→ notify linked tenant
→ Allocation/Receipt nếu applicable
```

Phải giữ Charge, Payment, Allocation, Receipt là source facts riêng.

### CX-04 — Tenancy Notice

```text
operator issues Notice
→ Notification cho linked participant user
→ tenant opens source Notice
→ acknowledgement stores user + timestamp
```

Delivery/acknowledgement không phải xác nhận hiệu lực pháp lý.

### CX-05 — Move-out

```text
ACTIVE
→ authorized user starts move-out
→ ENDING
→ notify relevant counterparty
→ operator confirms checkout
→ atomic: ENDED + Room VACANT
```

ENDING không được hiểu là Room đã vacant.

### CX-06 — Review / Trust Report moderation

Chỉ implement/test phần đã có authority. Các policy moderation/login/evidence/review multiplicity còn OPEN phải giữ OPEN.

## 7. Notification V1 use cases phải được cover

Canonical đã freeze capability cho:

1. new inquiry
2. payment due
3. payment confirmed
4. new incident
5. incident status changed
6. tenancy notice
7. move-out
8. review/report moderation

Test recipient/source/delivery facts.

**Không hardcode** push/email/SMS/Zalo vì channel policy vẫn OPEN.

## 8. Cách làm

### Phase A — Baseline + DISC-02 stability

1. Checkout working branch.
2. `pnpm install` nếu cần.
3. Docker compose up.
4. Confirm Pixel emulator online.
5. Run:
   - `pnpm e2e:coverage`
   - `pnpm typecheck`
   - `pnpm e2e:flow DISC-01`
6. Stabilize DISC-02.
7. Run DISC-02 ít nhất 5 lần liên tiếp; report từng run.

### Phase B — Backend/DB implementation gaps

Đi theo V1 case matrix, ưu tiên flow có dependency chung:

```text
Identity/auth contract
→ Inquiry + operator read
→ Notification delivery/source
→ Organization/Property/Room
→ Listing lifecycle
→ Tenancy/Participant/Terms/Ack
→ Activation/Move-out/Checkout
→ Billing/Payment/Deposit/Receipt
→ Incident/Notice
→ Portal/History/Dashboard
→ Review/Trust boundaries
```

Mỗi implementation phải thêm/điều chỉnh automated tests ở tầng phù hợp. Không biến test spec thành implementation giả.

### Phase C — Real cross-actor E2E

Khi Google config/session có thật:

- chạy authenticated Android flows;
- không bypass `AuthGuard`;
- không fake Google principal trong production runtime;
- có thể dùng deterministic fixtures cho domain data, nhưng auth phải dùng contract thật.

## 9. Gate bắt buộc

Ít nhất phải chạy và ghi kết quả thật:

```powershell
pnpm e2e:coverage
pnpm typecheck
pnpm test
pnpm test:conformance:database-v1
pnpm build
git diff --check
```

Runtime:

```powershell
docker compose ps
pnpm e2e:flow DISC-01
pnpm e2e:flow DISC-02
```

Các flow mới chỉ được chuyển sang `executable` khi UI/API/DB/invariant assertions đều GREEN.

Nếu thay đổi Android, chạy gate Android tương ứng bằng JBR Android Studio và backendDebug.

## 10. Quy tắc khi gặp OPEN/FUTURE

Nếu case chạm policy `OPEN`:

- không tự chọn behavior;
- không hardcode test để freeze policy;
- ghi `BLOCKED_BY_OPEN_POLICY` trong report;
- nêu chính xác câu hỏi cần authority quyết định.

Nếu capability là `FUTURE`:

- không implement;
- không thêm schema/API/UI để “cho đủ flow”.

## 11. Quy tắc Git

- Work trên `backend/v1-e2e-flow-closure`.
- Mỗi nhóm thay đổi commit riêng, message rõ domain.
- Không merge staging/main.
- Không force-push.
- Trước khi báo xong: fetch + kiểm tra divergence với staging.
- Nếu cần tích hợp thay đổi từ staging, báo trước khi tạo merge conflict lớn.

## 12. Report bắt buộc khi hoàn tất

Report phải tạo tại:

`tests/e2e/reports/v1-e2e-flow-closure-<YYYYMMDD>.md`

Dùng template:

`tests/e2e/reports/REPORT_TEMPLATE.md`

Không report kiểu “tests pass”. Phải có evidence.

Tối thiểu gồm:

- branch + final SHA;
- staging/base SHA;
- authority/contract SHA đã dùng;
- environment;
- scope thực hiện;
- flow/case totals;
- status từng feature group;
- command + exit code + result;
- UI evidence;
- API evidence;
- DB evidence;
- invariant/cross-actor evidence;
- failures + root cause;
- OPEN/FUTURE blocked cases;
- known gaps;
- files intentionally untouched;
- migration/schema impact;
- security/auth notes;
- exact list commits;
- READY_TO_MERGE: YES/NO.

## 13. Definition of Done

Không được ghi `READY_TO_MERGE: YES` chỉ vì static matrix đủ.

Chỉ YES khi:

- implementation trong scope đã hoàn tất;
- mandatory gates GREEN;
- executable flow không còn flaky;
- các business writes có UI/API/DB/invariant proof;
- cross-actor side effects đúng recipient/source;
- OPEN/FUTURE không bị freeze trái authority;
- report đầy đủ evidence và known gaps;
- branch không chứa unrelated local WIP.
