# Frontend Context

File này dành cho người đang làm Android app. Mục tiêu là để mở vào và biết ngay: **Frontend được quyết định gì, phải hỏi Backend ở đâu và những business rule nào không được tự nghĩ thêm ở UI**.

## 1. Frontend làm gì?

Android app chịu trách nhiệm phần người dùng nhìn thấy và thao tác:

- màn hình, navigation và UI state;
- nhận thao tác của người dùng;
- gọi Backend;
- map response thành dữ liệu dễ hiển thị;
- cache/preferences/client state khi cần;
- hiển thị loading/error/empty/success rõ ràng.

```mermaid
flowchart LR
    USER["User"] --> UI["Compose UI"]
    UI --> VM["ViewModel"]
    VM --> REP["Repository"]
    REP --> API["Backend API"]
    REP --> LOCAL["Local cache"]
```

Frontend **không tự quyết** business lifecycle hoặc dữ liệu gốc phía server.

## 2. Những gì Frontend có thể tự giữ

Frontend có thể có `UiState`, display model, navigation state, loading/error state và local cache riêng. Những model này phục vụ UI và phải map được về API/domain state chuẩn.

Ví dụ: UI có thể hiển thị nhãn “Đang cho thuê”, nhưng không được tạo persisted Listing state `RENTED` nếu contract chuẩn chỉ có `DRAFT | PUBLISHED | UNPUBLISHED | ARCHIVED`.

## 3. Nhìn project theo feature

```mermaid
flowchart TB
    AUTH["Đăng nhập / Identity"]
    DISC["Tìm phòng / Listing / Inquiry"]
    OWNER["Quản lý Property / Room"]
    RENT["Tenancy / My Rental"]
    FIN["Billing / Payment / Deposit / Receipt"]
    INC["Incident / History"]
    TRUST["Notice / Review / Trust"]

    AUTH --> DISC
    AUTH --> OWNER
    AUTH --> RENT
    OWNER --> FIN
    RENT --> FIN
    RENT --> INC
    RENT --> TRUST
```

Tenant Portal hiện gồm các capability quanh My Rental, Terms, Deposit, Billing, Payment, Receipts, Tickets, Notices, Move-out, History và Find Rooms, tùy vào quan hệ/quyền thật của User.

## 4. Khi người dùng bấm một nút nghiệp vụ

Ví dụ người dùng bấm **Kích hoạt lượt thuê**:

1. Frontend gửi yêu cầu activate.
2. Backend kiểm tra Room, Participant, Terms và các rule liên quan.
3. Database commit thay đổi nếu mọi thứ hợp lệ.
4. Frontend nhận state mới rồi mới cập nhật màn hình như một lần thuê đã active.

Không optimistic-commit business state quan trọng trước khi server xác nhận.

## 5. Dữ liệu local

Room database/DataStore hoặc local cache, nếu được tích hợp, chỉ phục vụ trải nghiệm client. Chúng không thay thế PostgreSQL phía server.

Search/Map cũng chỉ dùng vị trí công khai Backend trả về; không tự expose exact operational location chỉ vì một model cũ từng chứa field đó.

## 6. Checklist trước khi làm một feature

1. Mở backlog feature trong [`../../backlogs/v1/`](../../backlogs/v1/).
2. Đọc luồng tương ứng trong [`../end-to-end-flows.md`](../end-to-end-flows.md).
3. Kiểm tra thuật ngữ trong [`../product-domain.md`](../product-domain.md) / [`../glossary.md`](../glossary.md).
4. Xác định API cần có qua [`../integration-contracts.md`](../integration-contracts.md).
5. Kiểm tra Backend đã expose contract thật chưa; đừng suy từ mock/demo.
6. Nếu cần đổi business meaning, phối hợp Backend/Database thay vì workaround ở UI.

## 7. Đọc tiếp

- [`backend.md`](backend.md) — Backend xử lý thao tác người dùng ra sao.
- [`database.md`](database.md) — dữ liệu phía server được giữ/bảo vệ thế nào.
- [`../tech-stack.md`](../tech-stack.md) — stack và trạng thái integration hiện tại.
