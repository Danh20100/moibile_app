# Đặc tả hội tụ song song Frontend và Backend–Database

**Trạng thái:** ĐÃ CHỐT ĐỂ TRIỂN KHAI
**Ngày:** 2026-09-30
**Repository:** `onsra520/TroOi-Project`
**Baseline tích hợp:** `integration/full-stack-sync-runtime-staging`
**Baseline SHA:** `7669fca0c8af8fa24a5b48e1d5647c645c3cbb97`

## 1. Mục tiêu

Từ cùng một baseline sạch, chia công việc thành hai lane chạy song song:

- **KhanhBang:** chỉnh Frontend Android theo `docs/backlogs/v1/` và contract thật của hệ thống.
- **Duy Anh:** hội tụ Backend với Database, hoàn thiện persistence/API contract và verification.

Hai lane không sửa trực tiếp staging. Mỗi người làm trên branch riêng, tự test sạch, sau đó mới hội tụ lại vào staging theo thứ tự đã quy định.

Mục tiêu cuối cùng là một baseline full-stack trong đó Frontend, Backend và Database cùng bám một mô hình nghiệp vụ, không còn mỗi layer tự giữ một phiên bản riêng của TrọƠi.
## 2. Nguồn chuẩn phải đọc

Thứ tự ưu tiên khi có mâu thuẫn:

1. `docs/database/v1/canonical.md` — rule nghiệp vụ, lifecycle, cardinality, OPEN/FUTURE.
2. `docs/database/v1/erd/` và schema v1 — contract dữ liệu đã freeze.
3. `docs/contexts/` — cách hiểu chung của toàn hệ thống.
4. `docs/backlogs/v1/` — feature CURRENT/FROZEN theo góc nhìn Frontend ↔ Backend ↔ Database.
5. API/OpenAPI thật của Backend sau khi Duy Anh hoàn thiện.
6. Code hiện tại và test hiện tại.

Code hoặc test cũ không được dùng để phủ nhận source chuẩn ở trên. Ngược lại, tài liệu lịch sử trong `docs/superpowers/` không được rewrite hàng loạt chỉ để đổi cách gọi mới.

## 3. Quy tắc naming từ thời điểm này

Không tạo tên code, test, workflow, script hoặc branch mới chứa `ERD3`.

Tên mới dùng ngữ nghĩa hiện hành như:

- `database-v1`;
- `domain-contract`;
- `conformance`;
- `physical-contract`.

Những tên legacy còn trong runtime/test tooling phải được Duy Anh migrate sang tên mới mà không làm yếu test.
## 4. Branch topology và quyền sở hữu

Từ baseline `7669fca` tạo hai branch:

```text
integration/full-stack-sync-runtime-staging
├── frontend/backlog-v1-reconciliation
└── backend/database-v1-integration
```

### KhanhBang sở hữu

- `app/**`;
- test Android/frontend liên quan;
- `web/**` trong phạm vi đưa web về đúng vai trò marketing/preview, không mở rộng thành app nghiệp vụ thứ hai.

### Duy Anh sở hữu

- `src/**`;
- `database/**`;
- `tests/**` thuộc Backend/Database;
- `scripts/database/**`;
- `package.json` scripts liên quan Backend/Database;
- workflow Backend/Database;
- root/backend/database README khi cần phản ánh runtime thật.

`docs/contexts/`, `docs/backlogs/v1/` và `docs/database/v1/` là nguồn đọc. Không sửa business meaning ở các file này nếu chưa có owner decision.
## 5. Frontend — contract bắt buộc

Frontend hiện là foundation/demo của product model cũ. Rework phải giữ phần UI/Compose có giá trị nhưng thay business model bên dưới.

Bắt buộc:

- bỏ `USER.role = TENANT | LANDLORD` làm quyền toàn cục;
- capability/navigation dựa trên relationship/capability Backend trả về;
- không dùng một `RoomUi` để sở hữu đồng thời Room, Listing, Tenancy, Debt, Deposit, Review và discovery state;
- Search/Map chỉ dùng Listing `PUBLISHED` và public location projection;
- Inquiry không bị biến thành Booking/Reservation;
- full realtime Messaging vẫn là FUTURE;
- Subscription/Pricing/Quota là FUTURE, không xuất hiện như current core;
- Tenant Portal phải tiến tới My Rental, Terms, Deposit, Billing, Payment, Receipts, Tickets, Notices, Move-out, History, Find Rooms;
- Finance UI phải phân biệt Charge, Payment, Payment Allocation, Deposit và Receipt;
- Incident UI phải bám state machine chuẩn, không dùng status string tự do để mutate state;
- Dashboard chỉ render read model Backend trả về;
- Review và Trust Report không dùng một `score` chung thay cho semantics thật.

Android là sản phẩm chính. Web không được tiếp tục phát triển thành bản sao business app nếu chưa có quyết định mới.
## 6. Backend + Database — contract bắt buộc

Duy Anh xử lý Backend và Database trong cùng lane để tránh tình trạng domain service, repository, migration và guard tiến hóa lệch nhau.

Bắt buộc:

- Backend command/lifecycle phải bám Canonical và backlog hiện hành;
- persistence đi qua port/repository/transaction boundary, không để controller ghi thẳng database;
- PostgreSQL/PostGIS là server truth cho business data;
- migration/seed/runtime schema phải khớp Database v1 physical contract;
- các invariant concurrency-sensitive phải có enforcement ở persistence/database phù hợp;
- các workflow chạm nhiều entity phải có transaction boundary rõ;
- `OPEN` không được tự chốt trong DTO, migration, default hoặc test;
- `FUTURE` không được register thành current runtime chỉ vì module/scaffold đang tồn tại;
- Subscription và bulk CSV/Excel onboarding phải ở ngoài current core;
- Redis/MinIO không được claim là đã tích hợp nếu chưa có implementation + verification;
- OpenAPI phải phản ánh API thật đủ để Frontend consume, không để KhanhBang suy endpoint từ source code.

Duy Anh có quyền refactor code cũ để khớp contract, nhưng không được thay Canonical/Database v1 chỉ để giữ behavior legacy.
## 7. 13 file WIP local hiện tại

Trên máy coordinator đang có 13 file modified chưa commit từ lần reconcile trước. Chúng **không phải baseline** và không được handoff như code đã được duyệt.

Các finding hữu ích từ WIP:

- đổi path test/tool từ cấu trúc docs cũ sang `docs/database/v1/...`;
- sửa conformance test để đọc source chuẩn hiện tại;
- thêm `.worktrees` vào phạm vi cần prune khỏi naming scan;
- sửa persistence integration test dùng physical contract mới;
- cập nhật workflow cho branch hiện hành;
- root/database README cần phản ánh cấu trúc thật.

Duy Anh phải thực hiện lại các thay đổi cần thiết trên branch sạch, review từng diff và chạy verification mới.

Riêng naming-test, chỉ thêm `.worktrees` vào set exclude là chưa đủ nếu walker vẫn `rglob()` toàn cây. Implementation phải prune directory trước khi traverse sâu.

`database/README.md` hiện cũng stale vì vẫn nói chưa có migrations/seeds trong khi runtime đã có; phải viết lại theo trạng thái thật thay vì chỉ sửa một path.
## 8. Merge protocol bắt buộc

Không merge branch chỉ vì compile được.

Thứ tự hội tụ:

1. Hai lane triển khai song song từ cùng baseline.
2. Duy Anh hoàn tất Backend+Database, push branch và chạy toàn bộ gate của lane.
3. Khi Duy Anh GREEN, merge `backend/database-v1-integration` vào staging bằng merge commit.
4. KhanhBang fetch staging mới và merge staging vào `frontend/backlog-v1-reconciliation`.
5. KhanhBang resolve contract/API integration trên branch của mình và rerun toàn bộ Frontend gate.
6. Khi Frontend GREEN trên nền Backend+Database mới, merge Frontend branch vào staging.
7. Chạy final full-stack smoke/verification trên staging sau cả hai merge.

Không force-push, không rewrite history và không merge thẳng branch người này vào branch người kia.

## 9. Điều kiện hoàn thành chung

- không còn global landlord/tenant role làm authority;
- current Frontend feature map không kéo FUTURE vào core;
- API/OpenAPI đủ rõ để Android không invent contract;
- Backend current modules đọc/ghi qua persistence contract thật;
- Database migrations/schema/guards khớp Database v1;
- conformance/tooling không còn dùng `ERD3` trong tên active;
- test của từng lane pass trên SHA được merge;
- final staging pass các gate liên quan sau khi hội tụ.
## 10. STOP conditions

Dừng đúng nhánh quyết định và báo owner khi gặp một trong các trường hợp:

- Canonical, Database v1 và backlog mâu thuẫn về behavior cần triển khai;
- cần tự chọn một policy đang `OPEN`;
- cần đưa feature `FUTURE` vào current để làm cho code cũ chạy;
- cần thay lifecycle/cardinality/ownership đã freeze;
- Frontend cần endpoint mà Backend chưa có contract rõ và việc thêm endpoint làm đổi business meaning;
- migration hiện tại không thể reconcile với physical contract mà không phá dữ liệu/lịch sử migration;
- test cũ mâu thuẫn với source chuẩn nhưng chưa xác định được test nào phải thay;
- một lane buộc phải sửa file đang thuộc ownership của lane còn lại theo cách có thể gây conflict lớn.

Trong STOP condition, không workaround bằng mock, hidden default hoặc compatibility state mới.
