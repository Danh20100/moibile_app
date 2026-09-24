# Incident Architecture

Status: Draft

## 1. Purpose

`incident` chịu trách nhiệm quản lý vòng đời của một sự cố trong TrọƠi.

Module này trả lời:

- một sự cố có được tạo hay không;
- sự cố đang ở trạng thái nào;
- actor có được phép thực hiện action hay không;
- transition tiếp theo có hợp lệ hay không;
- sự cố đã được xử lý đến đâu;
- sự cố đã được đóng hay chưa.

## 2. Architectural Principle

Module tuân theo **Contract-first + persistence-agnostic business flows**.

Business flow phải tồn tại độc lập với database, notification provider, attachment storage, user profile, room database representation và service partner system.

Business rule được xác định trước infrastructure.

## 3. Knowledge Boundary

Incident chỉ cần biết các reference cần thiết để thực hiện trách nhiệm của mình.

Ở mức logic, incident có thể biết rằng actor A báo sự cố tại room X.

Incident chưa cần biết:

- tên actor A;
- avatar;
- email;
- profile đầy đủ;
- giá thuê của room X;
- địa chỉ chi tiết của room X;
- chủ trọ của room X;
- thiết bị hoặc push token của bất kỳ actor nào.

Thông tin chỉ được bổ sung khi một flow cụ thể thực sự cần nó.

## 4. Business Flows

Lifecycle cơ bản:

Reported → Acknowledged → Processing → Resolved → Closed.

Một nhánh có thể tồn tại khi đang xử lý:

Processing → Need More Information → Processing.

Incident sở hữu quy tắc chuyển trạng thái này.

Module khác không được tự thay đổi state của incident mà không đi qua public boundary của `incident`.

## 5. State & Invariants

Các invariant chính:

- incident phải gắn với một room reference hợp lệ theo business context;
- incident phải có reporter reference;
- transition phải hợp lệ;
- incident đã đóng không được tiếp tục xử lý như incident đang mở;
- historical state quan trọng không được âm thầm xóa;
- incident state độc lập với room state;
- module không tự suy luận quyền truy cập từ dữ liệu nội bộ của module khác.

## 6. Public Boundary

Các module khác được tương tác với `incident` thông qua business capability công khai như:

- tạo incident;
- xác nhận incident;
- bắt đầu xử lý;
- yêu cầu thêm thông tin;
- đánh dấu đã giải quyết;
- đóng incident;
- đọc trạng thái và lịch sử được phép công khai.

Bên ngoài không được chỉnh sửa trực tiếp internal state hoặc timeline của incident.

## 7. Cross-module Relationships

Incident có thể liên kết với:

- `identity-access` để nhận access decision;
- `room` để xác nhận room reference trong business context;
- `tenancy` khi quyền report phụ thuộc vào quan hệ thuê;
- `audit-trust` để lưu các business fact cần audit;
- notification layer để thông báo các thay đổi quan trọng.

Các module giao tiếp ưu tiên qua reference, decision và event.

Incident không lấy toàn bộ user hoặc room object rồi tự suy luận business rule thuộc module khác.

## 8. Ownership

`incident` sở hữu:

- incident lifecycle;
- incident state;
- transition rules;
- incident timeline;
- quan hệ giữa incident và các reference cần thiết;
- các business fact phát sinh từ lifecycle của incident.

Incident không sở hữu:

- user identity;
- user profile;
- room lifecycle;
- tenancy lifecycle;
- technician profile;
- service marketplace;
- push notification infrastructure;
- attachment storage implementation.

## 9. Persistence Boundary

Incident business flow không phụ thuộc vào cách incident được lưu.

Persistence chỉ chịu trách nhiệm lưu, tìm và phục hồi incident cùng lịch sử cần thiết.

Architecture phải cho phép đi từ temporary persistence sang database persistence mà không thay đổi lifecycle hoặc transition rules.

Database không được trở thành nơi định nghĩa business invariant.

## 10. Events & Side Effects

Incident có thể phát sinh business facts khi:

- incident được tạo;
- incident được xác nhận;
- incident bắt đầu xử lý;
- incident cần thêm thông tin;
- incident được giải quyết;
- incident được đóng.

Các side effect như notification, audit, analytics hoặc service coordination không thuộc core lifecycle của `incident`.

Incident chỉ công bố business fact cần thiết; module nhận event tự xử lý trách nhiệm của mình.

Trong flow A tạo incident → B nhận thông báo → B phản hồi → A nhận phản hồi, incident chỉ cần biết incident nào thay đổi, actor reference nào thực hiện action và business state nào vừa xảy ra.

Incident không cần biết tên A, tên B, thiết bị, push token, notification UI hoặc provider delivery.

## 11. Error & Testing View

Business errors tập trung vào domain incident:

- incident không tồn tại;
- transition không hợp lệ;
- actor không có quyền;
- reference không hợp lệ;
- incident đã đóng.

Infrastructure errors phải được xử lý bên ngoài core business logic.

Testing tập trung vào behavior và invariant:

- tạo incident thành công;
- transition hợp lệ được chấp nhận;
- transition sai bị từ chối;
- actor không đủ quyền bị từ chối;
- profile chưa tồn tại không ảnh hưởng lifecycle nếu flow không cần profile;
- persistence implementation khác nhau vẫn cho cùng behavior contract.

## 12. Evolution

Giai đoạn đầu tập trung vào lifecycle thuần túy và invariant.

Giai đoạn tiếp theo bổ sung persistence.

Sau đó bổ sung access validation thông qua `identity-access`, `tenancy` và `room`.

Tiếp theo bổ sung audit và notification.

Các giai đoạn sau mới mở rộng attachment, richer incident content và controlled service partner integration.

Mỗi layer được bổ sung quanh core flow thay vì viết lại core flow.
