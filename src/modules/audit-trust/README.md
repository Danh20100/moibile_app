# Audit & Trust

Folder `audit-trust` chứa các chức năng liên quan đến **lưu vết thay đổi quan trọng và report nội bộ** trong TrọƠi.

## Folder này dùng để làm gì?

Folder này giúp hệ thống biết **ai đã làm gì, với resource nào và vào thời điểm nào**.

Nó chịu trách nhiệm cho:

- audit event;
- actor/action/resource/timestamp metadata;
- lịch sử thay đổi quan trọng;
- internal report;
- dữ liệu phục vụ tra cứu và đối chiếu.

```mermaid
flowchart LR
    Action["Domain Action"] --> Audit["audit-trust"]
    Audit --> Event["Audit Event"]
    Audit --> History["History"]
    Audit --> Report["Internal Report"]
```

## Chức năng chính

### Audit Event

Các thay đổi quan trọng từ module khác có thể tạo audit event.

```mermaid
flowchart TD
    Actor["Actor"] --> Event["Audit Event"]
    Action["Action"] --> Event
    Resource["Resource"] --> Event
    Time["Timestamp"] --> Event
```

Ví dụ nhóm dữ liệu cần lưu vết gồm:

- thay đổi quyền truy cập;
- tenancy terms;
- deposit;
- billing/công nợ;
- receipt;
- incident status;
- import dữ liệu quan trọng.

### History Lookup

Audit history dùng để tra cứu lại quá trình thay đổi khi cần đối chiếu.

```mermaid
flowchart LR
    Resource["Resource"] --> Events["Audit Events"] --> Timeline["History Timeline"]
```

### Internal Report

Người dùng có thể gửi report nội bộ khi phát hiện thông tin hoặc hành vi cần được kiểm tra.

```mermaid
flowchart LR
    User["User"] --> Report["Internal Report"] --> Review["Platform Review"] --> Result["Classification / Handling"]
```

Report nội bộ không đồng nghĩa với public rating hoặc kết luận ai đúng/sai.

## Quan hệ với các module khác

```mermaid
flowchart TD
    IA["identity-access"] --> Audit["audit-trust"]
    Tenancy["tenancy"] --> Audit
    Billing["billing"] --> Audit
    Receipt["receipt"] --> Audit
    Incident["incident"] --> Audit
    Onboarding["onboarding"] --> Audit
    Room["room"] --> Audit
```

`audit-trust` là cross-cutting module nhận các sự kiện cần lưu vết từ những bounded context khác.

## Không thuộc folder này

- public review/rating;
- phán xử tranh chấp;
- cưỡng chế owner/operator/tenant ngoài đời thực;
- bảo đảm pháp lý;
- business logic chính của các resource được audit.

## Tóm tắt

```mermaid
flowchart LR
    Action["Action"] --> Event["Audit Event"] --> History["History / Lookup"]
    User["User"] --> Report["Internal Report"]
```

`audit-trust` tập trung vào: **audit event → lịch sử thay đổi → tra cứu/đối chiếu → report nội bộ**.
