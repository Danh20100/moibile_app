# Receipt

Folder `receipt` chứa các chức năng liên quan đến **bản ghi thanh toán, biên nhận và xác nhận phục vụ đối chiếu** trong TrọƠi.

## Folder này dùng để làm gì?

Folder này ghi nhận việc một khoản tiền đã được thanh toán hoặc được hai bên xác nhận ở mức vận hành.

Nó chịu trách nhiệm cho:

- payment record;
- receipt record;
- liên kết receipt với khoản phải thu;
- attachment/reference chứng minh giao dịch khi có;
- trạng thái xác nhận;
- lịch sử chỉnh sửa và đối chiếu liên quan.

```mermaid
flowchart LR
    Billing["billing"] --> Receivable["Receivable"]
    Receivable --> Receipt["Receipt"]
    Receipt --> Tenant["Tenant View / Confirmation"]
    Receipt --> Audit["audit-trust"]
```

## Chức năng chính

### Record Payment

Owner/operator có thể ghi nhận một khoản đã thu và liên kết nó với billing tương ứng.

```mermaid
flowchart TD
    Payment["Payment Recorded"] --> Match["Link to Receivable"]
    Match --> Receipt["Receipt Created"]
```

### Receipt & Confirmation

Receipt cung cấp dữ liệu để owner/operator và tenant cùng xem và đối chiếu.

```mermaid
flowchart LR
    Receipt["Receipt"] --> Owner["Owner / Operator"]
    Receipt --> Tenant["Tenant"]
    Tenant --> Confirmation["Confirmation when needed"]
```

### History

Các thay đổi quan trọng của receipt cần có khả năng truy vết.

```mermaid
flowchart LR
    Create["Create"] --> Update["Update"] --> Confirm["Confirm"]
    Create --> Audit["audit-trust"]
    Update --> Audit
    Confirm --> Audit
```

## Quan hệ với các module khác

```mermaid
flowchart LR
    Billing["billing"] --> Receipt["receipt"]
    Tenancy["tenancy"] --> Receipt
    IA["identity-access"] --> Receipt
    Receipt --> Audit["audit-trust"]
```

- `billing`: cung cấp khoản phải thu cần đối chiếu;
- `tenancy`: xác định kỳ thuê liên quan;
- `identity-access`: xác định ai được xem/xác nhận;
- `audit-trust`: lưu vết thay đổi quan trọng.

## Không thuộc folder này

- payment gateway hoặc settlement ngân hàng;
- tính toán tổng công nợ;
- billing cycle;
- subscription payment;
- chứng từ pháp lý thay cho các bên.

## Tóm tắt

```mermaid
flowchart LR
    Receivable["Receivable"] --> Receipt["Receipt"] --> Confirmation["View / Confirm"] --> History["Audit History"]
```

`receipt` tập trung vào: **ghi nhận khoản thanh toán → tạo biên nhận → xác nhận/đối chiếu → lưu lịch sử**.
