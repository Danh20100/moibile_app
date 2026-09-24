# Tenancy Architecture

Status: Draft

## 1. Purpose

`tenancy` đại diện cho một kỳ thuê cụ thể giữa room và tenant trong TrọƠi.

Module này chịu trách nhiệm về quan hệ thuê theo thời gian, các điều khoản vận hành nền và lifecycle của kỳ thuê.

## 2. Architectural Principle

Module tuân theo **Contract-first + persistence-agnostic business flows**.

Tenancy phải được mô tả bằng business relationship và lifecycle trước khi có database, ORM, billing implementation hoặc user profile đầy đủ.

Persistence chỉ lưu và phục hồi tenancy; database không định nghĩa tenancy lifecycle.

## 3. Knowledge Boundary

Tenancy chỉ cần room reference, tenant identity reference, thời gian thuê, các điều khoản nền và tenancy state cần thiết.

Module không cần biết đầy đủ tenant profile, authentication implementation, billing cycle chi tiết, receipt confirmation hoặc incident lifecycle.

Một tenant reference hợp lệ có thể tồn tại trong tenancy ngay cả khi profile presentation chưa được enrich đầy đủ.

## 4. Business Flows

Các business flow chính gồm:

- tạo một tenancy cho room và tenant reference;
- ghi nhận các điều khoản vận hành nền của kỳ thuê;
- kích hoạt tenancy;
- bắt đầu quá trình kết thúc kỳ thuê;
- kết thúc tenancy;
- cung cấp rental-term context cho billing và receipt.

Tenancy không tự tạo billing cycle; nó chỉ cung cấp context thuộc ownership của mình.

## 5. State & Invariants

Tenancy lifecycle hiện tại gồm Draft, Active, Ending và Ended.

Các transition đã được xác định gồm:

- Draft sang Active;
- Active sang Ending;
- Ending sang Ended;
- Active sang Ended khi business flow cho phép kết thúc trực tiếp.

Các invariant chính:

- tenancy phải tham chiếu một room hợp lệ;
- tenancy phải có tenant identity context cần thiết;
- tenancy state độc lập với room state;
- billing status không được dùng thay tenancy state;
- receipt confirmation không thay đổi trực tiếp tenancy lifecycle;
- điều khoản của tenancy là nguồn context, không biến tenancy thành billing module.

## 6. Public Boundary

Các module khác chỉ được tương tác với tenancy thông qua capability công khai như:

- tạo hoặc đọc tenancy;
- xác nhận tenancy reference;
- đọc lifecycle state cần thiết;
- yêu cầu transition hợp lệ;
- đọc rental-term context được phép dùng;
- xác nhận quan hệ giữa room và tenant trong kỳ thuê.

Bên ngoài không được chỉnh sửa trực tiếp tenancy state hoặc terms.

## 7. Cross-module Relationships

Tenancy liên kết với:

- `room` để tham chiếu đơn vị được thuê;
- `identity-access` để nhận tenant identity và access decision;
- `billing` để cung cấp rental-term context cho chu kỳ thu tiền;
- `receipt` để liên kết bản ghi thanh toán với kỳ thuê;
- `audit-trust` để lưu các business fact quan trọng.

Quan hệ này không chuyển ownership của billing, receipt hoặc identity sang tenancy.

## 8. Ownership

`tenancy` sở hữu:

- tenancy identity ở mức business;
- quan hệ giữa room và tenant reference trong một kỳ thuê;
- tenancy lifecycle;
- thời gian bắt đầu và kết thúc;
- rent amount, deposit và recurring-fee baseline ở mức điều khoản nền;
- move-in và move-out context thuộc kỳ thuê.

`tenancy` không sở hữu:

- room profile;
- authentication;
- tenant profile presentation;
- billing cycle;
- debt calculation;
- receipt confirmation;
- incident lifecycle.

## 9. Persistence Boundary

Tenancy business flow không phụ thuộc database schema hoặc storage engine.

Persistence chỉ lưu và phục hồi tenancy, state, time range, terms và references cần thiết.

Việc thay persistence mechanism không được làm thay đổi lifecycle hoặc ownership boundary của tenancy.

## 10. Events & Side Effects

Tenancy có thể phát sinh business fact khi:

- tenancy được tạo;
- tenancy được kích hoạt;
- rental terms thay đổi theo business rule;
- tenancy bắt đầu ending;
- tenancy kết thúc.

Billing generation, notification, audit hoặc analytics là side effect do module có trách nhiệm tương ứng xử lý.

## 11. Error & Testing View

Business errors tập trung vào domain tenancy, ví dụ:

- tenancy không tồn tại;
- room reference không hợp lệ;
- tenant identity context không hợp lệ;
- tenancy transition không hợp lệ;
- action không được phép trong trạng thái hiện tại.

Testing tập trung vào behavior:

- tenancy được tạo với room và tenant reference hợp lệ;
- chỉ lifecycle transition đã được định nghĩa được chấp nhận;
- tenant profile chưa enrich không làm tenancy mất ý nghĩa nếu identity reference hợp lệ;
- billing và receipt không được tự thay đổi tenancy state;
- thay persistence mechanism không làm thay đổi behavior contract.

## 12. Evolution

Giai đoạn đầu cần room reference, tenant reference, terms và lifecycle cơ bản.

Giai đoạn tiếp theo bổ sung identity/access validation rõ hơn.

Sau đó billing và receipt sử dụng tenancy context thông qua public boundary.

Các giai đoạn sau có thể enrich move-out flow hoặc additional operational terms khi business được chốt, nhưng không chuyển billing logic vào tenancy.
