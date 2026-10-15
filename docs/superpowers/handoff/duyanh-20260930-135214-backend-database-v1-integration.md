# HANDOFF — Backend + Database v1 Integration

**Người nhận:** `duyanh`
**Tạo lúc:** `2026-09-30 13:52:14 +07:00`
**Repository:** `onsra520/TroOi-Project`
**Branch phải tạo:** `backend/database-v1-integration`
**Branch gốc:** `integration/full-stack-sync-runtime-staging`
**Baseline SHA:** `7669fca0c8af8fa24a5b48e1d5647c645c3cbb97`

## Nhiệm vụ

Hội tụ Backend và Database thành một runtime nhất quán: domain/application command đúng, persistence thật, migration/schema đúng Database v1, transaction/concurrency guard đúng và OpenAPI đủ rõ để Frontend sử dụng.
Bạn sở hữu cả Backend lẫn Database trong lane này để tránh hai phần tiếp tục drift. KhanhBang đang làm Frontend song song trên branch khác. Không sửa trực tiếp staging và không merge vào branch Frontend.

## Bắt đầu branch

```powershell
git fetch origin --prune
git checkout -b backend/database-v1-integration 7669fca0c8af8fa24a5b48e1d5647c645c3cbb97
git status --short --branch
```

Nếu coordinator đã tạo branch remote, checkout tracking branch tương ứng thay vì tạo lại.

## Tài liệu bắt buộc đọc

1. `docs/superpowers/specs/2026-09-30-parallel-integration-reconciliation-design.md`
2. `docs/superpowers/plans/2026-09-30-parallel-integration-reconciliation.md`
3. `docs/contexts/layers/backend.md`
4. `docs/contexts/layers/database.md`
5. `docs/backlogs/v1/README.md`
6. `docs/database/v1/README.md`
7. `docs/database/v1/canonical.md` và physical contract khi cần.
## Việc đầu tiên: dọn naming active

Từ thời điểm này không dùng `ERD3` trong tên code/test/workflow/script mới.

Active tooling cần hội tụ về naming hiện hành, ví dụ:

```text
tests/conformance/database-v1/
.github/workflows/backend-database-v1-conformance.yml
pnpm test:conformance:database-v1
```

Migrate package scripts, workflow paths, imports và test references tương ứng. Không rewrite các file lịch sử cũ trong `docs/superpowers/` chỉ để đổi tên.

Mục tiêu là đổi tên mà giữ nguyên hoặc tăng độ chặt của conformance tests; không được dùng rename như cơ hội bỏ assertion đang khó pass.
## 13 file WIP local: chỉ dùng như finding

Coordinator có 13 file modified chưa commit từ lần reconcile trước. **Không copy worktree đó làm baseline**.

Những finding cần bạn thực hiện lại có chủ đích:

- test/tool path phải trỏ về `docs/database/v1/canonical.md` và `docs/database/v1/erd/*`;
- conformance tests không được phụ thuộc legacy `PROJECT_CONTEXT/SYSTEM_CONTEXT/USE_CASES`;
- persistence migration parity và trust guard tests phải đọc physical contract hiện hành;
- workflow chỉ target branch active;
- root README cần phản ánh Android + Backend + Database + web marketing đúng hiện trạng;
- `database/README.md` phải bỏ mô tả “chưa có migration/seed” vì runtime đã có;
- naming scanner phải prune `.worktrees` trước traversal, không chỉ filter file sau `rglob()`.

Review lại từng finding, viết/đổi test trước khi sửa nếu behavior chưa được pin, rồi commit theo nhóm logic.
## Thứ tự thực thi đề nghị

### D0 — Baseline

- chạy test/gate hiện có và ghi pass/fail thật;
- xác nhận migration/schema/persistence source hiện tại;
- không coi test pass ở branch cũ là evidence cho branch này.

### D1 — Naming + path reconciliation

- migrate active conformance naming sang `database-v1`;
- sửa docs path coupling;
- sửa `.worktrees` traversal;
- sửa README runtime stale;
- focused test GREEN trước khi đi tiếp.

### D2 — Database runtime

- verify migration lên database sạch;
- verify seed;
- verify physical catalog parity;
- review rollback preparation và chỉ claim điều đã chứng minh;
- không thêm FUTURE schema.
### D3 — Backend ↔ Persistence

- rà CURRENT modules và tìm service nào còn in-memory/stub;
- nối application/domain command qua persistence ports/repositories;
- workflow nhiều bảng phải đi qua transaction manager/coordinator;
- giữ concurrency-sensitive invariant ở persistence/database layer;
- không register Subscription hoặc bulk CSV/Excel onboarding thành current runtime;
- không đưa Redis/MinIO vào scope.

### D4 — API/OpenAPI

- controller/DTO phải bám command và backlog hiện hành;
- capability/relationship thay cho global landlord/tenant role;
- Search/Map chỉ expose public projection;
- OpenAPI tag/description không quảng bá FUTURE như CURRENT;
- cung cấp cách generate/export contract ổn định để KhanhBang dùng sau khi lane này merge.

### D5 — Verification và freeze branch

Chạy đầy đủ gate Backend + Database, ghi exact SHA và kết quả thật. Sau đó push branch và gửi completion report; không tự merge staging.
## Verification tối thiểu

Sau khi rename active scripts, các command tương đương phải tồn tại và pass:

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

Chạy thêm persistence/concurrency integration tests bị ảnh hưởng bởi diff. Nếu test cần `TEST_DATABASE_URL`, ghi rõ môi trường và command đã dùng.
## Phối hợp với KhanhBang

KhanhBang đang refactor Frontend song song. Bạn không chờ Frontend mới làm persistence/API.

Bạn cần ưu tiên làm API/OpenAPI đủ ổn định để sau khi branch Backend+Database merge vào staging, KhanhBang có thể sync staging mới và nối adapter thật.

Không sửa `app/**` hoặc implement UI giúp Frontend. Nếu thấy Frontend cần contract mới, ghi contract/gap trong completion report hoặc expose API đúng backlog nếu semantics đã rõ.

Backend+Database lane **merge trước**. Chỉ sau khi branch này GREEN và được merge vào staging, KhanhBang mới sync staging vào branch Frontend và chạy final reconciliation.
## STOP conditions

Dừng phần quyết định liên quan và báo owner nếu:

- Canonical/Database v1/backlog mâu thuẫn;
- cần tự chốt policy `OPEN`;
- cần đưa `FUTURE` vào current runtime để làm test pass;
- cần đổi migration history đã shared theo cách destructive;
- cần đổi frozen ownership/cardinality/lifecycle;
- persistence strategy không thể bảo vệ invariant đã chốt;
- test cũ mâu thuẫn source chuẩn nhưng chưa xác định được expected behavior;
- API cần semantics mà backlog/canonical chưa định nghĩa.

## Completion report

```text
BRANCH: backend/database-v1-integration
FINAL SHA:
NAMING/PATH MIGRATION:
BACKEND↔DB WORK COMPLETED:
OPENAPI CONTRACT STATUS:
TESTS RUN + RESULTS:
KNOWN GAPS:
OPEN / OWNER DECISIONS:
READY_TO_MERGE: YES/NO
```

Push branch và gửi report; không tự merge vào staging.
