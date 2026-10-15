# Kế hoạch hội tụ song song Frontend và Backend–Database

**Spec:** `docs/superpowers/specs/2026-09-30-parallel-integration-reconciliation-design.md`
**Baseline branch:** `integration/full-stack-sync-runtime-staging`
**Baseline SHA:** `7669fca0c8af8fa24a5b48e1d5647c645c3cbb97`

## 1. Nguyên tắc thực thi

Hai người bắt đầu cùng lúc nhưng không cùng sửa một branch.

```text
staging @ 7669fca
├── frontend/backlog-v1-reconciliation      — KhanhBang
└── backend/database-v1-integration         — Duy Anh
```

Mỗi task phải có diff reviewable, verification tương ứng và commit riêng hợp lý. Không tích lũy toàn bộ công việc thành một commit lớn.

Không ai được merge vào staging trước khi lane của mình đạt gate đã mô tả. Trong quá trình làm, chỉ push branch cá nhân để owner/reviewer có thể xem tiến độ.
## 2. Lane A — KhanhBang / Frontend

### F0 — Tạo branch và chụp baseline

- Tạo `frontend/backlog-v1-reconciliation` từ đúng staging SHA.
- Xác nhận working tree sạch trước khi sửa.
- Đọc `docs/contexts/layers/frontend.md`, `docs/backlogs/v1/README.md` và các backlog theo feature.
- Không copy 13 file WIP local của coordinator.

### F1 — Gỡ global role khỏi identity/navigation

- Thay `UserRole.TENANT/LANDLORD` làm authority bằng session/capability model.
- Một user có thể đồng thời có discovery, tenant và operator capability.
- Navigation phải dựa trên capability/context thực tế, không dùng `switchRole()` như business operation.
- Viết test cho mapping capability → navigation/access state.
### F2 — Tách UI model theo feature boundary

- Không dùng `RoomUi` như business model tổng hợp của cả hệ thống.
- Tách model/view-state tối thiểu cho discovery Listing, operational Room, tenancy summary, billing/payment/deposit/receipt và incident.
- UI model chỉ chứa dữ liệu cần hiển thị và phải map được về API response thật.
- Không lưu exact operational address trong discovery model nếu Backend chỉ expose public location.

### F3 — Reconcile Discovery

- Search/Map chỉ hiển thị Listing public.
- Giữ UX search/map hiện có nếu hữu ích nhưng loại hard-code mang nghĩa business.
- Inquiry là contact intent; không biến thành reservation/booking state machine.
- Booking UI hiện tại phải được cô lập khỏi current domain hoặc thay bằng flow Inquiry/contact theo contract.
- Full realtime chat không được phát triển thêm như current feature.
### F4 — Reconcile Owner Operations và Tenant Portal

- Owner side: Organization → Property → Room → Listing/Tenancy/Incident theo backlog.
- Tenant side: My Rental, Terms, Deposit, Billing, Payment, Receipts, Tickets, Notices, Move-out, History, Find Rooms.
- Không suy Payment từ `expected - debt`.
- Không suy Receipt từ debt state.
- Deposit requirement và deposit funded/held/settlement phải là các meaning khác nhau.
- Incident action phải theo lifecycle Backend trả về, không dùng một nút “Hoàn tất” cho mọi state.
- Dashboard chỉ render read model, không tự tính business truth từ `RoomUi`.

### F5 — Dọn FUTURE/legacy presentation

- Subscription/Pricing/Quota không còn xuất hiện như current core.
- `BookingUi`, full chat và saved/favorites nâng cao không được mở rộng thành domain mới.
- Review UI không dùng một `score` chung cho listing accuracy và rental review.
- Trust Report cần để đúng backlog nếu API đã có; không invent moderation policy.
### F6 — Web về đúng vai trò

- Không tiếp tục mở rộng `web/` như product SPA song song với Android.
- Giữ hoặc refactor web theo hướng marketing/preview phù hợp context hiện tại.
- Nếu việc xóa product route web gây scope lớn, cô lập chúng và ghi rõ legacy thay vì phát triển tiếp.

### F7 — API adapter sau khi Backend contract ổn định

- Trước khi Duy Anh publish OpenAPI ổn định, Frontend chỉ chuẩn hóa repository interface/model boundary.
- Không đoán endpoint/DTO.
- Sau khi Backend lane GREEN và merge vào staging, merge staging mới vào branch Frontend.
- Reconcile Android repository với OpenAPI thật.
- Chạy lại toàn bộ Frontend test/build trước khi xin merge.

### Frontend verification gate

Trên Windows, tối thiểu chạy:

```powershell
.\gradlew.bat testDebugUnitTest
.\gradlew.bat lintDebug
.\gradlew.bat assembleDebug
cd web
npm test
npm run check
```

Nếu có emulator/device phù hợp, chạy thêm `connectedDebugAndroidTest` trước completion report.
## 3. Lane B — Duy Anh / Backend + Database

### D0 — Tạo branch sạch và baseline

- Tạo `backend/database-v1-integration` từ đúng staging SHA.
- Không checkout/copy dirty worktree của coordinator.
- Chạy baseline hiện tại và ghi lại pass/fail thật trước khi sửa.
- Đọc Canonical, Database v1, contexts, backlogs và current persistence implementation.

### D1 — Xóa naming legacy khỏi active tooling

Migrate active runtime/test/tooling sang naming `database-v1` hoặc `domain-contract`:

- thư mục conformance active → `tests/conformance/database-v1/`;
- workflow active → tên `backend-database-v1-conformance.yml`;
- script `test:conformance:*` dùng tên `database-v1`;
- update package scripts, CI paths, imports và test references tương ứng.

Không rewrite các artifact lịch sử cũ trong `docs/superpowers/` chỉ để đổi tên.
### D2 — Reconcile 13 finding từ WIP local

Thực hiện lại trên branch sạch, không copy mù diff local:

- đổi physical/conceptual/logical contract path sang `docs/database/v1/erd/...`;
- đổi canonical path sang `docs/database/v1/canonical.md`;
- conformance test phải đọc docs hiện hành thay vì legacy context files;
- sửa naming scanner để prune `.worktrees` trước khi traverse;
- persistence migration parity/trust guard tests dùng physical contract hiện hành;
- workflow chỉ chạy trên branch active phù hợp;
- root README và `database/README.md` phản ánh repository/runtime thật.

Sau mỗi nhóm thay đổi phải chạy focused test tương ứng trước khi commit.

### D3 — Xác minh và sửa Database runtime

- Migrations hiện hành phải tạo catalog tương thích physical contract Database v1.
- Seed development phải chạy trên schema vừa migrate.
- Không rewrite migration đã shared nếu không có lý do/versioning strategy rõ.
- Kiểm tra rollback preparation hiện tại; không claim rollback an toàn nếu chưa chứng minh.
- Không tạo schema cho feature FUTURE chỉ để chuẩn bị trước.
### D4 — Nối Backend services với persistence thật

- Rà từng CURRENT module trong `src/modules/` và xác định chỗ nào còn in-memory/stub.
- Current business write phải đi qua persistence port/repository hoặc coordinator phù hợp.
- Transaction manager phải bao các workflow chạm nhiều aggregate/bảng.
- Giữ các guard concurrency-sensitive ở database/persistence layer, không chỉ kiểm tra trước bằng service read.
- Không register `subscription` hoặc bulk onboarding như current core.
- Không đưa Redis/MinIO vào scope này.

Ưu tiên dependency order:

```text
Identity / Organization
→ Property / Room
→ Listing / Search / Inquiry
→ Tenancy / Participant / Terms
→ Billing / Payment / Deposit / Receipt
→ Incident / History / Trust
→ Dashboard / Notification read surfaces
```

Nếu module hiện tại chưa có feature CURRENT tương ứng, ghi gap rõ thay vì fake implementation.
### D5 — Ổn định API/OpenAPI cho Frontend

- Rà controller/DTO theo backlog CURRENT.
- Không expose generic status mutation nếu command cần lifecycle/business guard riêng.
- OpenAPI description/tag không được quảng bá FUTURE như current core.
- Tạo cách xuất/generate OpenAPI artifact ổn định để KhanhBang consume hoặc verify contract.
- API phải thể hiện public projection riêng cho Search/Map và capability/relationship thay vì global role.
- Những API chưa có policy vì `OPEN` phải giữ contract tối thiểu, không invent default.

### D6 — Verification Backend + Database

Tối thiểu:

```powershell
pnpm typecheck
pnpm lint
pnpm test:core-foundation
pnpm test:conformance:database-v1
python -m unittest discover -s tests/database -p "test_*.py"
pnpm test
```

Với PostgreSQL dev environment:

```powershell
pnpm db:dev:up
pnpm db:migrate
pnpm db:seed
pnpm test:persistence:migration
```

Chạy thêm persistence integration/concurrency tests hiện có phù hợp với thay đổi. Không claim pass nếu test không thực sự được chạy.
## 4. Hội tụ hai lane

### Gate 1 — Backend + Database merge trước

Duy Anh chỉ xin merge khi:

- working tree sạch;
- branch đã push;
- verification report ghi exact SHA;
- Database migration/persistence gates liên quan đã pass;
- active conformance naming không còn `ERD3`;
- OpenAPI đủ để Frontend reconcile.

Merge bằng merge commit vào `integration/full-stack-sync-runtime-staging`.

### Gate 2 — Frontend sync lại staging

Sau Gate 1, KhanhBang:

```text
git fetch origin --prune
git checkout frontend/backlog-v1-reconciliation
git merge origin/integration/full-stack-sync-runtime-staging
```

Không rebase/force để che lịch sử. Resolve contract changes trên branch Frontend, sau đó chạy lại toàn bộ Frontend gate.
### Gate 3 — Frontend merge và full-stack smoke

Frontend chỉ merge khi test/build pass trên branch đã chứa Backend+Database staging mới.

Sau merge Frontend, staging phải chạy ít nhất:

- Backend typecheck/lint/test/conformance;
- database validator + migration parity cần thiết;
- Android unit/lint/build;
- web check/test nếu web còn được giữ;
- smoke flow quan trọng dựa trên API contract hiện hành.

## 5. Completion report của mỗi người

Mỗi lane report:

```text
BRANCH
FINAL SHA
TASKS HOÀN THÀNH
TEST/COMMAND ĐÃ CHẠY + KẾT QUẢ
KNOWN GAPS
OPEN/OWNER DECISIONS
FILES/AREAS CỐ Ý KHÔNG ĐỤNG
READY_TO_MERGE: YES/NO
```

Không dùng “done” nếu còn test chưa chạy hoặc gap chưa được phân loại.
