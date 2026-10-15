# HANDOFF — Frontend Backlog v1 Reconciliation

**Người nhận:** `khanhbang`
**Tạo lúc:** `2026-09-30 13:52:14 +07:00`
**Repository:** `onsra520/TroOi-Project`
**Branch phải tạo:** `frontend/backlog-v1-reconciliation`
**Branch gốc:** `integration/full-stack-sync-runtime-staging`
**Baseline SHA:** `7669fca0c8af8fa24a5b48e1d5647c645c3cbb97`
**Trạng thái:** `READY_FOR_PARALLEL_EXECUTION`

## Nhiệm vụ

Reconcile Android Frontend hiện tại với `docs/backlogs/v1/` và source chuẩn mới, giữ phần UI/Compose foundation có giá trị nhưng loại business model cũ đang nằm trong client.

Bạn không làm Backend/Database. Duy Anh sẽ xử lý lane đó song song trên branch riêng. Không sửa trực tiếp staging và không merge vào branch của Duy Anh.
## Bắt đầu branch

```powershell
git fetch origin --prune
git checkout -b frontend/backlog-v1-reconciliation 7669fca0c8af8fa24a5b48e1d5647c645c3cbb97
git status --short --branch
```

Nếu branch đã được coordinator tạo trên remote, checkout tracking branch tương ứng thay vì tạo lại.

## Tài liệu bắt buộc đọc

1. `docs/superpowers/specs/2026-09-30-parallel-integration-reconciliation-design.md`
2. `docs/superpowers/plans/2026-09-30-parallel-integration-reconciliation.md`
3. `docs/contexts/layers/frontend.md`
4. `docs/contexts/product-domain.md`
5. `docs/backlogs/v1/README.md`
6. backlog của feature đang sửa.
7. `docs/database/v1/canonical.md` khi cần quyết định lifecycle/ownership.
## Finding chính từ audit hiện tại

### P0 — Identity đang sai mô hình

Hiện có `UserRole.TENANT/LANDLORD`, login chọn role và `switchRole()` đổi toàn bộ app context. Canonical không có global user role.

Cần chuyển sang capability/relationship model. Một user có thể đồng thời browse, là tenant và vận hành Organization.

### P0 — `RoomUi` đang là god model

`RoomUi` hiện chứa Room + Listing + tenant + debt + deposit + discovery + rating. Tách UI/view-state theo feature boundary để không biến client model thành source business truth.

### P0 — FUTURE đang xuất hiện như current

`SubscriptionPlan`, subscription screen, capacity/add-block/pricing hiện không thuộc current core. Không tiếp tục phát triển feature này như CURRENT.
### P1 — Discovery đang demo nhiều hơn domain thật

Search/Map UX có thể reuse, nhưng map pin/filter/data hiện hard-code. Discovery phải dùng Listing `PUBLISHED` và public location projection.

`BookingUi`/lịch xem phòng không được coi là Inquiry domain. Inquiry là contact intent và không bắt buộc trước Tenancy. Full realtime chat vẫn FUTURE.

### P1 — Tenant Portal thiếu phần lõi

Navigation hiện thiên về Home/Saved/Schedule/Messages/Profile. Current portal phải tiến tới:

```text
My Rental / Terms / Deposit / Billing / Payment
Receipts / Tickets / Notices / Move-out / History / Find Rooms
```

### P1 — Finance semantics đang trộn

Không dùng `expected - debt = collected` làm Payment truth. Không suy Receipt từ debt. Deposit requirement không phải deposit actual funded/held.
### P1 — Incident lifecycle chưa đúng

UI hiện dùng status string tự do và một action “Hoàn tất”. Rework phải bám state/action do Backend contract cung cấp và giữ timeline event.

### P2 — Dashboard / Review / Trust

Dashboard chỉ render read model từ Backend. Không tự tính occupancy/debt/payment truth từ client snapshot.

`room.score` hiện bị dùng cho cả listing accuracy và review. Tách semantics. Review eligibility và Trust Report phải theo backlog, không invent policy OPEN.

### Web

`web/` hiện là product SPA có login, tenant và landlord routes trong khi context hiện xác định web là marketing/landing. Không mở rộng SPA nghiệp vụ. Repurpose/cô lập legacy behavior theo plan.
## Phối hợp với lane Duy Anh

Duy Anh làm trên `backend/database-v1-integration` và có thể thay đổi controller/DTO/OpenAPI trong lúc bạn đang refactor UI model.

Trong giai đoạn song song:

- bạn được chuẩn hóa repository interface/client model;
- không được đoán endpoint chưa tồn tại;
- không hardcode response chỉ để unblock UI;
- ghi rõ API dependency còn thiếu theo feature.

Khi Backend+Database đã GREEN và merge vào staging, merge staging mới vào branch Frontend của bạn, reconcile adapter theo OpenAPI thật, rồi rerun toàn bộ gate.

Không merge branch Frontend vào staging trước bước sync này.
## Verification trước khi xin merge

Tối thiểu:

```powershell
.\gradlew.bat testDebugUnitTest
.\gradlew.bat lintDebug
.\gradlew.bat assembleDebug
cd web
npm test
npm run check
```

Nếu môi trường có emulator/device, chạy thêm:

```powershell
.\gradlew.bat connectedDebugAndroidTest
```

Sau khi sync Backend+Database staging, phải chạy lại gate; kết quả cũ trước khi sync không đủ để merge.
## STOP conditions

Dừng phần quyết định liên quan và báo owner nếu:

- API cần thiết buộc phải invent business policy đang OPEN;
- cần đưa Booking/Subscription/full realtime messaging trở lại current core;
- Backend contract và backlog/canonical mâu thuẫn;
- một UI flow chỉ có thể hoàn thành bằng cách tự mutate business state ở client;
- cần sửa Backend/Database để workaround Frontend;
- merge staging mới tạo conflict ngoài phạm vi Frontend sở hữu.

## Completion report

```text
BRANCH: frontend/backlog-v1-reconciliation
FINAL SHA:
FEATURES RECONCILED:
API DEPENDENCIES RESOLVED:
TESTS RUN + RESULTS:
KNOWN GAPS:
OPEN / OWNER DECISIONS:
READY_TO_MERGE: YES/NO
```

Push branch và gửi report; không tự merge vào staging.
