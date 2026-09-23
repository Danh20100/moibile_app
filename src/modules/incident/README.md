# Incident

Folder `incident` chứa các chức năng liên quan đến **ticket sự cố và lịch sử xử lý sự cố** trong TrọƠi.

## Folder này dùng để làm gì?

Folder này quản lý toàn bộ vòng đời một sự cố phát sinh tại room.

Nó chịu trách nhiệm cho:

- tạo incident/ticket;
- category và description;
- reporter;
- attachment references;
- trạng thái xử lý;
- người tiếp nhận/xử lý khi có;
- timeline và các mốc thời gian quan trọng.

```mermaid
flowchart LR
    Reporter["Tenant / Operator"] --> Incident["Incident"]
    Incident --> Room["room"]
    Incident --> Timeline["Timeline"]
    Incident --> Audit["audit-trust"]
```

## Chức năng chính

### Create Incident

Tenant hoặc operator có thể tạo ticket gắn với đúng room.

```mermaid
flowchart TD
    Report["Report Issue"] --> Detail["Category + Description"]
    Detail --> Attachment["Images / Videos"]
    Attachment --> Ticket["Incident Created"]
```

### Incident Lifecycle

```mermaid
stateDiagram-v2
    [*] --> New
    New --> Acknowledged
    Acknowledged --> Processing
    Processing --> NeedMoreInformation
    NeedMoreInformation --> Processing
    Processing --> Resolved
    Resolved --> Closed
```

State của incident tách hoàn toàn khỏi `room.status`.

### Timeline

Mỗi thay đổi quan trọng được ghi theo thời gian để hai bên theo dõi quá trình xử lý.

```mermaid
flowchart LR
    Created["Created"] --> Acknowledged["Acknowledged"] --> Processing["Processing"] --> Resolved["Resolved"] --> Closed["Closed"]
```

## Quan hệ với các module khác

```mermaid
flowchart LR
    Room["room"] --> Incident["incident"]
    IA["identity-access"] --> Incident
    Incident --> Audit["audit-trust"]
```

- `room`: room phát sinh sự cố;
- `identity-access`: xác định reporter và quyền truy cập;
- `audit-trust`: lưu vết thay đổi và lịch sử quan trọng.

## Không thuộc folder này

- sửa chữa thực tế;
- marketplace đối tác dịch vụ;
- báo giá của partner;
- room lifecycle;
- public review/rating.

## Tóm tắt

```mermaid
flowchart LR
    Report["Report"] --> Ticket["Incident"] --> Status["Tracking"] --> Timeline["History"] --> Close["Closed"]
```

`incident` tập trung vào: **báo sự cố → ticket → trạng thái xử lý → timeline → đóng sự cố**.
