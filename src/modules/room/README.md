# Room

Folder `room` chứa các chức năng liên quan đến **đơn vị cho thuê cốt lõi** trong TrọƠi.

## Folder này dùng để làm gì?

Folder này quản lý hồ sơ vận hành cơ bản của từng phòng/tài sản cho thuê.

Nó chịu trách nhiệm cho:

- room profile;
- room code/name;
- trạng thái vận hành chính của room;
- liên kết room với property;
- điểm neo để tenancy, billing, incident và listing tham chiếu.

```mermaid
flowchart TD
    Property["property"] --> Room["Room"]
    Room --> Tenancy["tenancy"]
    Room --> Billing["billing"]
    Room --> Incident["incident"]
    Room --> Listing["listing"]
```

## Chức năng chính

### Room Profile

Quản lý thông tin nhận diện và metadata cơ bản của room.

Ví dụ:

- mã phòng;
- tên phòng;
- thuộc property nào;
- trạng thái hiện tại;
- thông tin vận hành cơ bản cần thiết.

### Room State

Room có state riêng, tách khỏi tenancy, billing hoặc incident.

```mermaid
stateDiagram-v2
    [*] --> Draft
    Draft --> Vacant
    Vacant --> Occupied
    Occupied --> Vacant
    Vacant --> Maintenance
    Occupied --> Maintenance
    Maintenance --> Vacant
    Vacant --> Archived
```

Một room có thể đang `Occupied` nhưng đồng thời có billing quá hạn hoặc incident đang mở. Vì vậy các workflow đó không được gom vào `room.status`.

### Operational Anchor

Room là object trung tâm để các workflow khác gắn vào.

```mermaid
flowchart LR
    Room["Room"]
    Room --> T["Tenancies"]
    Room --> B["Billing Cycles"]
    Room --> I["Incidents"]
    Room --> L["Listings"]
```

## Quan hệ với các module khác

```mermaid
flowchart LR
    Property["property"] --> Room["room"]
    Room --> Tenancy["tenancy"]
    Room --> Billing["billing"]
    Room --> Incident["incident"]
    Room --> Listing["listing"]
    Room --> Audit["audit-trust"]
```

## Không thuộc folder này

- tenant assignment và tenancy lifecycle;
- billing cycle hoặc công nợ;
- receipt;
- incident status;
- listing public content;
- subscription entitlement.

## Tóm tắt

```mermaid
flowchart LR
    Property["Property"] --> Room["Room"] --> Workflows["Tenancy / Billing / Incident / Listing"]
```

`room` tập trung vào: **room profile → room state → liên kết với property → điểm neo cho các workflow khác**.
