# Billing Architecture

Status: Draft

## 1. Purpose

`billing` quản lý chu kỳ thu tiền, khoản phải thu và trạng thái công nợ theo từng kỳ của một tenancy.

Module này chịu trách nhiệm biến rental-term context và dữ liệu phí cần thiết thành một billing cycle có thể được theo dõi theo thời gian.

## 2. Architectural Principle

Module tuân theo **Contract-first + persistence-agnostic business flows**.

Billing lifecycle và receivable rule phải được xác định trước database, payment gateway, receipt implementation, framework hoặc transport cụ thể.

Billing không được rút gọn thành một cờ paid trên room.

## 3. Knowledge Boundary

Billing chỉ cần tenancy context, room reference, các khoản charge cần thiết và kết quả đối chiếu thanh toán ở mức cần cho receivable.

Module không cần biết đầy đủ tenant profile, payment gateway details, bank settlement, subscription SaaS hoặc receipt internals.

Billing chỉ sử dụng thông tin từ module khác trong phạm vi cần thiết cho việc tính và theo dõi khoản phải thu.

## 4. Business Flows

Các business flow chính gồm:

- tạo billing cycle theo tenancy context;
- ghi nhận các charge của kỳ;
- xác định tổng số tiền cần thu;
- theo dõi số tiền đã được đối chiếu từ receipt;
- xác định outstanding balance;
- theo dõi due date và billing state theo thời gian.

Mỗi billing cycle tồn tại độc lập với các cycle trước và sau.

## 5. State & Invariants

Billing lifecycle hiện tại gồm Upcoming, Due, Partial, Overdue và Paid.

Các transition đã được xác định gồm:

- Upcoming sang Due;
- Due sang Paid;
- Due sang Partial;
- Partial sang Paid;
- Due sang Overdue;
- Partial sang Overdue;
- Overdue sang Paid.

Các invariant chính:

- billing cycle phải gắn với tenancy context hợp lệ;
- amount paid phải được đối chiếu từ nguồn thanh toán/receipt có thẩm quyền;
- billing state độc lập với room state;
- billing state độc lập với tenancy lifecycle dù có liên quan về context;
- receipt record vẫn thuộc `receipt`, không thuộc billing;
- subscription billing của TrọƠi không thuộc module này.

## 6. Public Boundary

Các module khác chỉ được tương tác với billing thông qua capability công khai như:

- tạo hoặc đọc billing cycle;
- đọc các charge và receivable state được phép công khai;
- cập nhật billing theo business fact thanh toán đã được xác nhận;
- xác nhận outstanding balance;
- yêu cầu state transition hợp lệ theo thời gian và payment outcome.

Bên ngoài không được chỉnh trực tiếp receivable state hoặc outstanding balance.

## 7. Cross-module Relationships

Billing liên kết với:

- `tenancy` để nhận rental-term context;
- `room` để giữ room reference liên quan;
- `receipt` để nhận payment/receipt outcome phục vụ đối chiếu;
- `audit-trust` để lưu các business fact về công nợ quan trọng.

Billing không lấy ownership của tenancy hoặc receipt.

## 8. Ownership

`billing` sở hữu:

- billing cycle;
- charge composition của từng kỳ;
- total due;
- outstanding balance;
- due date;
- billing state;
- logic theo dõi khoản phải thu theo kỳ.

`billing` không sở hữu:

- tenancy lifecycle;
- room status;
- receipt record;
- payment gateway;
- bank settlement;
- subscription SaaS của TrọƠi.

## 9. Persistence Boundary

Billing business flow không phụ thuộc database schema hoặc ORM representation.

Persistence chỉ lưu và phục hồi billing cycle, charges, receivable state và references cần thiết.

Database không được trở thành nơi định nghĩa transition hoặc cách tính business state.

## 10. Events & Side Effects

Billing có thể phát sinh business fact khi:

- billing cycle được tạo;
- khoản phải thu đến hạn;
- payment outcome làm thay đổi outstanding balance;
- billing chuyển sang Partial, Overdue hoặc Paid;
- charge thay đổi theo business rule.

Notification, audit, analytics hoặc reminder delivery là side effect bên ngoài core billing lifecycle.

## 11. Error & Testing View

Business errors tập trung vào domain billing, ví dụ:

- billing cycle không tồn tại;
- tenancy context không hợp lệ;
- charge hoặc payment outcome không hợp lệ;
- billing transition không hợp lệ;
- dữ liệu đối chiếu không đủ để thay đổi receivable state.

Testing tập trung vào behavior:

- billing cycle được tạo từ tenancy context hợp lệ;
- lifecycle chỉ đi qua transition đã được xác định;
- amount paid được phản ánh từ receipt outcome nhưng receipt ownership không đổi;
- billing quá hạn không tự thay đổi room state;
- subscription logic không đi vào billing;
- thay persistence mechanism không làm thay đổi behavior contract.

## 12. Evolution

Giai đoạn đầu tập trung vào cycle, charges, receivable và state theo kỳ.

Giai đoạn tiếp theo receipt outcome được nối vào để cập nhật amount paid và outstanding balance.

Sau đó có thể bổ sung reminder, audit hoặc analytics thông qua event/side-effect boundary.

Các mở rộng sau này phải giữ billing là module công nợ theo tenancy, không biến nó thành payment gateway hoặc subscription system.
