# Luồng End-to-End TrọƠi

Tài liệu này mô tả các luồng đi xuyên Product → Frontend → Backend → Database. Mục đích là để ba layer hiểu cùng một business story và không tự tạo semantics khác nhau.

## 1. Tìm phòng và Inquiry

```mermaid
sequenceDiagram
    actor U as Người tìm phòng
    participant FE as Android App
    participant BE as Backend
    participant DB as PostgreSQL/PostGIS

    U->>FE: Tìm phòng / mở bản đồ
    FE->>BE: Query published listings
    BE->>DB: Search public projection
    DB-->>BE: Listing + public location
    BE-->>FE: Search results
    FE-->>U: Danh sách / map
    U->>FE: Gửi Inquiry
    FE->>BE: Create Inquiry
    BE->>DB: Persist Inquiry
    DB-->>BE: Saved
    BE-->>FE: Inquiry created
```

Chỉ Listing `PUBLISHED` và public location được dùng cho discovery. Inquiry không bắt buộc để tạo Tenancy.

## 2. Tạo và kích hoạt Tenancy

```mermaid
sequenceDiagram
    actor O as Operator
    participant FE as Android App
    participant BE as Backend
    participant DB as Database

    O->>FE: Tạo quan hệ thuê
    FE->>BE: Create Tenancy for Room
    BE->>DB: Guard one non-terminal tenancy
    DB-->>BE: Eligible
    BE->>DB: Persist DRAFT Tenancy
    O->>FE: Thêm Participant + Terms
    FE->>BE: Save Participant / Terms
    BE->>DB: Persist versioned facts
    O->>FE: Activate Tenancy
    FE->>BE: Activate command
    BE->>DB: Atomic tenancy/room/listing guards
    DB-->>BE: Commit ACTIVE + OCCUPIED + listing unavailable
    BE-->>FE: Updated state
```

## 3. Billing → Payment → Receipt

```mermaid
flowchart LR
    TERMS[Applicable Terms version] --> BC[Billing Cycle]
    BC --> CH[Charges]
    USER[Record money received] --> PAY[Confirmed Payment]
    PAY --> ALLOC[Payment Allocation]
    ALLOC --> CH
    PAY --> DEP[Deposit Application]
    PAY --> REC[Receipt]
```

Luồng này phải giữ ba khái niệm riêng: nghĩa vụ phải thu (`Charge`), tiền thực nhận (`Payment`) và bằng chứng (`Receipt`). UI không được gom chúng thành một mutable “paid status” rồi coi đó là source of truth.

## 4. Báo và xử lý sự cố

```mermaid
sequenceDiagram
    actor T as Tenant/Participant
    participant FE as Android App
    participant BE as Incident Module
    participant DB as Database
    T->>FE: Báo sự cố
    FE->>BE: Create Incident
    BE->>DB: Persist REPORTED + event
    BE-->>FE: Incident state
    FE->>BE: Các command xử lý tiếp theo
    BE->>DB: Validate transition + append IncidentEvent
    DB-->>BE: New state/history
    BE-->>FE: Render current state + timeline
```

`INCIDENT_EVENT` là append-only history. Notification có thể được trigger bởi sự kiện nhưng không được mutate Incident source state.

## 5. Checkout / Move-out

```mermaid
flowchart TD
    A[Tenancy ACTIVE] --> B[Start ending]
    B --> C[Tenancy ENDING]
    C -->|Hủy move-out| A
    C -->|Confirmed checkout| D[Atomic workflow]
    D --> E[Tenancy ENDED]
    D --> F[Room VACANT]
    F --> G[Revalidate current Listing]
    G --> H[Next rental cycle]
```

Không có direct `ACTIVE → ENDED`. Checkout là workflow phối hợp Tenancy và Room.

## 6. Room state ↔ Listing coupling

```mermaid
flowchart LR
    RV[Room VACANT + ACTIVE] --> LP[Listing PUBLISHED]
    LP --> D{Room rời VACANT?}
    D -->|Có| LU[Listing UNPUBLISHED]
    D -->|Không| LP
    LU --> R{Room VACANT lại?}
    R -->|Có, đủ điều kiện| LP
    R -->|Không / retired| LA[Listing ARCHIVED]
```

Frontend chỉ hiển thị state đã được trả về; Backend điều phối transition; Database bảo vệ constraint/current-listing integrity.

## 7. Tenant Portal và relationship-based access

```mermaid
flowchart TD
    U[Authenticated USER] --> LINK{Có liên kết với Tenancy Participant?}
    LINK -->|Không| DISC[Discovery capabilities]
    LINK -->|Có| AUTH[Authorize theo relationship/resource]
    AUTH --> PORTAL[My Rental / Terms / Deposit / Billing / Payment / Receipts / Tickets / Notices / Move-out / History]
```

Tenant capability không đến từ `User.role = tenant`.

## 8. Review / Trust Report

Review eligibility đến từ quan hệ thuê đủ điều kiện. Trust Report target đúng một Listing hoặc Review và tách biệt với Incident. Các policy canonical còn `OPEN` không được UI/API tự chọn default.

## 9. Nguyên tắc chung cho mọi flow

- Frontend gửi intent, không gửi “business truth đã quyết định sẵn”.
- Backend validate command và sở hữu orchestration.
- Database là nơi enforcement cuối cho invariant cần transaction/concurrency safety.
- Response/read model quay lại Frontend để render state mới.
- Side effect như Notification chạy theo source fact, không trở thành nguồn fact mới.
