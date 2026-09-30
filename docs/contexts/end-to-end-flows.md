# Các luồng chính từ đầu đến cuối

Tài liệu này kể lại các luồng quan trọng theo cách người dùng nhìn thấy, rồi cho biết thao tác đó đi qua Frontend, Backend và Database như thế nào.

## 1. Tìm phòng và gửi nhu cầu liên hệ

```mermaid
sequenceDiagram
    actor U as Người tìm phòng
    participant FE as Android App
    participant BE as Backend
    participant DB as PostgreSQL/PostGIS

    U->>FE: Tìm phòng / mở bản đồ
    FE->>BE: Yêu cầu danh sách phòng đang công khai
    BE->>DB: Tìm Listing PUBLISHED theo public location
    DB-->>BE: Kết quả phù hợp
    BE-->>FE: Danh sách / vị trí công khai
    FE-->>U: Hiển thị kết quả
    U->>FE: Chọn "Tôi quan tâm / Liên hệ"
    FE->>BE: Tạo Inquiry
    BE->>DB: Lưu Inquiry
    BE-->>FE: Đã ghi nhận
```

Chỉ Listing `PUBLISHED` được dùng cho discovery. Inquiry giúp nối hai bên nhưng không phải booking và không bắt buộc phải có trước Tenancy.

## 2. Tạo và kích hoạt một lần thuê

```mermaid
sequenceDiagram
    actor O as Chủ trọ / người vận hành
    participant FE as Android App
    participant BE as Backend
    participant DB as Database

    O->>FE: Tạo lượt thuê cho Room
    FE->>BE: Create Tenancy
    BE->>DB: Kiểm tra Room chưa có Tenancy chưa kết thúc
    BE->>DB: Lưu DRAFT Tenancy
    O->>FE: Thêm người tham gia + điều khoản
    FE->>BE: Lưu Participant / Terms
    BE->>DB: Lưu dữ liệu có lịch sử
    O->>FE: Kích hoạt lượt thuê
    FE->>BE: Activate Tenancy
    BE->>DB: Transaction kiểm tra và cập nhật Tenancy + Room + Listing
    DB-->>BE: Commit
    BE-->>FE: Trạng thái mới
```

Khi activation thành công, Tenancy mới thực sự `ACTIVE`, Room chuyển `OCCUPIED` và Listing đang public phải được xử lý nhất quán. Frontend không tự đổi ba state này trước khi Backend trả kết quả.

## 3. Tạo khoản phải thu, ghi nhận thanh toán và phát hành biên nhận

```mermaid
flowchart LR
    TERMS["Terms áp dụng"] --> CYCLE["Kỳ tính tiền"]
    CYCLE --> CHARGE["Khoản phải thu"]
    MONEY["Tiền đã nhận"] --> PAYMENT["Confirmed Payment"]
    PAYMENT --> ALLOC["Phân bổ vào Charge"]
    ALLOC --> CHARGE
    PAYMENT --> DEP["Áp dụng vào Deposit"]
    PAYMENT --> RECEIPT["Receipt"]
```

UI cần giúp người dùng phân biệt rõ: **phải thu**, **đã nhận tiền**, **cọc**, **biên nhận**. Không gom tất cả thành một nút “đã thanh toán” rồi dùng nó như dữ liệu gốc.

## 4. Báo và xử lý sự cố

```mermaid
sequenceDiagram
    actor T as Người thuê
    participant FE as Android App
    participant BE as Backend
    participant DB as Database

    T->>FE: Báo sự cố
    FE->>BE: Tạo Incident
    BE->>DB: Lưu Incident REPORTED + event đầu tiên
    BE-->>FE: Trạng thái hiện tại
    FE->>BE: Gửi thao tác xử lý tiếp theo
    BE->>DB: Kiểm tra transition + append IncidentEvent
    DB-->>BE: State và timeline mới
    BE-->>FE: Dữ liệu để hiển thị
```

Lịch sử sự cố không bị ghi đè. Notification có thể được gửi theo sự kiện nhưng không được tự đổi trạng thái Incident.

## 5. Trả phòng

```mermaid
flowchart TD
    A["Tenancy ACTIVE"] --> B["Bắt đầu trả phòng"]
    B --> C["Tenancy ENDING"]
    C -->|"Hủy trả phòng"| A
    C -->|"Xác nhận checkout"| D["Transaction"]
    D --> E["Tenancy ENDED"]
    D --> F["Room VACANT"]
    F --> G["Kiểm tra lại Listing"]
    G --> H["Sẵn sàng cho vòng thuê tiếp theo"]
```

`ENDING` chưa có nghĩa Room đã trống. Chỉ khi checkout được xác nhận thì Tenancy mới `ENDED` và Room mới trở về `VACANT`.

## 6. Room và Listing phải đi cùng nhau

```mermaid
flowchart LR
    R["Room VACANT + ACTIVE"] --> L["Listing PUBLISHED"]
    L --> X{"Room rời VACANT?"}
    X -->|"Có"| U["Listing UNPUBLISHED"]
    X -->|"Không"| L
    U --> V{"Room VACANT lại và đủ điều kiện?"}
    V -->|"Có"| L
    V -->|"Không còn dùng"| A["Listing ARCHIVED"]
```

Frontend chỉ hiển thị state hệ thống trả về. Backend kiểm tra/điều phối thay đổi. Database bảo vệ các ràng buộc có thể bị race.

## 7. Tenant Portal và quyền dựa trên quan hệ

```mermaid
flowchart TD
    U["USER đã đăng nhập"] --> L{"Có link với Tenancy Participant?"}
    L -->|"Không"| D["Discovery / Find Rooms"]
    L -->|"Có"| A["Kiểm tra quyền theo Tenancy"]
    A --> P["My Rental / Terms / Deposit / Billing / Payment / Receipts / Tickets / Notices / Move-out / History"]
```

Người dùng không có quyền tenant chỉ vì một global role. Quyền đến từ Participant/Tenancy thực tế.

## 8. Review và Trust Report

Review chỉ xuất hiện khi người dùng có lịch sử thuê đủ điều kiện. Trust Report dùng để báo vấn đề với Listing hoặc Review. Một report không tự động xóa nội dung; các policy còn `OPEN` vẫn phải để `OPEN`.

## 9. Nguyên tắc chung

- Frontend gửi **thao tác người dùng muốn làm**, không tự quyết kết quả nghiệp vụ.
- Backend kiểm tra quyền/rule và điều phối những thay đổi liên quan.
- Database là lớp bảo vệ cuối cho các ràng buộc cần transaction hoặc concurrency safety.
- Frontend cập nhật UI từ response/state mới sau khi thao tác hoàn tất.
- Notification và Dashboard đi theo dữ liệu gốc, không trở thành nguồn ghi nghiệp vụ mới.
