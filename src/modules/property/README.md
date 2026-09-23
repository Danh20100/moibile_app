# Property

Folder `property` chứa các chức năng liên quan đến **tài sản/khu trọ ở cấp địa điểm** trong TrọƠi.

## Folder này dùng để làm gì?

Folder này dùng để quản lý một property như một nhóm các phòng cùng thuộc một tài sản hoặc địa điểm vận hành.

Nó chịu trách nhiệm cho:

- property profile;
- tên và địa chỉ;
- thông tin vị trí;
- quan hệ property → rooms;
- trạng thái tồn tại của property trong hệ thống.

```mermaid
flowchart TD
    Org["organization"] --> Property["Property"]
    Property --> RoomA["Room A"]
    Property --> RoomB["Room B"]
    Property --> RoomC["Room C"]
```

## Chức năng chính

### Property Profile

Quản lý thông tin chung của một tài sản/khu trọ như:

- tên property;
- địa chỉ;
- thông tin mô tả vận hành ở cấp property;
- location reference;
- trạng thái active/archive khi cần.

### Location

Property là nguồn vị trí nền cho các chức năng cần biết tài sản nằm ở đâu.

```mermaid
flowchart LR
    Property["Property"] --> Location["Address / Location"]
    Location --> Listing["listing"]
    Listing --> Map["Map / Discovery"]
```

`listing` có thể sử dụng location từ property để hiển thị discovery/map, nhưng nội dung public của tin đăng không thuộc `property`.

### Room Grouping

Một property có thể chứa nhiều room.

```mermaid
flowchart TD
    Property["Property"]
    Property --> R1["Room 101"]
    Property --> R2["Room 102"]
    Property --> R3["Room 103"]
```

## Quan hệ với các module khác

```mermaid
flowchart LR
    Org["organization"] --> Property["property"]
    Property --> Room["room"]
    Property --> Listing["listing"]
    Property --> Audit["audit-trust"]
```

- `organization`: sở hữu phạm vi property;
- `room`: quản lý từng đơn vị cho thuê bên trong property;
- `listing`: dùng thông tin vị trí khi publish phòng;
- `audit-trust`: lưu vết thay đổi quan trọng.

## Không thuộc folder này

- trạng thái chi tiết của từng room;
- tenancy;
- billing và receipt;
- incident;
- listing public;
- map provider hoặc geocoding implementation.

## Tóm tắt

```mermaid
flowchart LR
    Organization["Organization"] --> Property["Property"] --> Rooms["Rooms"]
    Property --> Location["Location"]
```

`property` tập trung vào: **tài sản/khu trọ → vị trí → nhóm room**.
