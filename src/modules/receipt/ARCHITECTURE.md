# Receipt Architecture

Status: Draft

## 1. Purpose

`receipt` quản lý bản ghi thanh toán, biên nhận và trạng thái xác nhận phục vụ đối chiếu vận hành trong TrọƠi.

Module này chịu trách nhiệm ghi nhận rằng một khoản tiền đã được thanh toán hoặc được hai bên xác nhận ở mức vận hành, đồng thời giữ lịch sử cần thiết để tra cứu.

## 2. Architectural Principle

Module tuân theo **Contract-first + persistence-agnostic business flows**.

Receipt flow phải được xác định trước database, payment gateway, bank settlement, file storage hoặc framework cụ thể.

Receipt là record phục vụ đối chiếu; nó không thay thế settlement system hoặc chứng từ pháp lý.

## 3. Knowledge Boundary

Receipt chỉ cần billing/receivable reference, tenancy context cần thiết, actor reference, payment record context và confirmation/history information phù hợp.

Module không cần biết payment gateway internals, bank settlement details, đầy đủ user profile hoặc cách billing tính tổng công nợ.

Nếu dữ liệu xác nhận hoặc attachment chưa tồn tại, receipt không tự tạo giả thông tin đó.

## 4. Business Flows

Các business flow chính gồm:

- ghi nhận một payment record;
- liên kết payment record với receivable phù hợp;
- tạo receipt để hai bên cùng xem và đối chiếu;
- ghi nhận confirmation khi business flow yêu cầu;
- duy trì lịch sử thay đổi quan trọng của receipt.

Receipt trả kết quả đối chiếu cần thiết cho billing nhưng không tự tính lại toàn bộ debt logic.

## 5. State & Invariants

README hiện mô tả các mốc Create, Update và Confirm nhưng chưa chốt một state machine đầy đủ, vì vậy architecture không tự thêm tên state mới.

Các invariant chính:

- receipt phải tham chiếu đúng receivable/billing context khi được tạo từ một khoản phải thu;
- payment record và receipt history phải có khả năng truy vết;
- confirmation không được tự suy ra nếu chưa có actor/action phù hợp;
- receipt không tự tính tổng outstanding balance;
- receipt không đại diện cho bank settlement;
- receipt không được mô tả như chứng từ pháp lý thay cho các bên.

## 6. Public Boundary

Các module khác chỉ được tương tác với receipt thông qua capability công khai như:

- ghi nhận payment record;
- tạo hoặc đọc receipt;
- xác nhận receipt khi business flow cho phép;
- đọc history được phép công khai;
- cung cấp payment/receipt outcome cần thiết cho billing.

Bên ngoài không được chỉnh trực tiếp internal history hoặc confirmation state.

## 7. Cross-module Relationships

Receipt liên kết với:

- `billing` để tham chiếu receivable cần đối chiếu;
- `tenancy` để giữ kỳ thuê liên quan;
- `identity-access` để nhận actor/access decision khi cần xem hoặc xác nhận;
- `audit-trust` để lưu các business fact quan trọng.

Receipt cung cấp outcome cho billing nhưng billing vẫn sở hữu receivable và debt calculation.

## 8. Ownership

`receipt` sở hữu:

- payment record ở mức vận hành;
- receipt record;
- liên kết receipt với receivable reference;
- confirmation state khi business flow yêu cầu;
- attachment/reference phục vụ đối chiếu khi có;
- receipt history thuộc phạm vi module.

`receipt` không sở hữu:

- billing cycle;
- outstanding-balance calculation;
- tenancy lifecycle;
- payment gateway;
- bank settlement;
- subscription payment;
- legal adjudication.

## 9. Persistence Boundary

Receipt business flow không phụ thuộc database schema hoặc storage engine.

Persistence chỉ lưu và phục hồi payment record, receipt, confirmation/history và references cần thiết.

Attachment storage implementation nếu có là infrastructure concern và không được định nghĩa core receipt behavior.

## 10. Events & Side Effects

Receipt có thể phát sinh business fact khi:

- payment được ghi nhận;
- receipt được tạo;
- receipt được cập nhật theo business rule;
- receipt được xác nhận;
- đối chiếu tạo ra outcome cần chuyển cho billing.

Audit, notification hoặc analytics là side effect bên ngoài core receipt responsibility.

## 11. Error & Testing View

Business errors tập trung vào domain receipt, ví dụ:

- receipt không tồn tại;
- receivable reference không hợp lệ;
- payment record không đủ context;
- confirmation không hợp lệ;
- actor không có quyền thực hiện action.

Testing tập trung vào behavior:

- payment record được liên kết đúng receivable context;
- receipt được tạo và truy vết được;
- confirmation chỉ xảy ra khi business flow cho phép;
- receipt không tự tính debt;
- billing nhận outcome mà không lấy receipt ownership;
- thay persistence mechanism không làm thay đổi behavior contract.

## 12. Evolution

Giai đoạn đầu cần payment record, receipt record và liên kết với billing context.

Giai đoạn tiếp theo bổ sung confirmation và history rõ hơn khi flow sản phẩm cần.

Sau đó attachment, audit và notification có thể được nối vào qua boundary tương ứng.

Các giai đoạn sau phải giữ receipt là bản ghi vận hành phục vụ đối chiếu, không biến module thành payment processor hoặc legal document system.
