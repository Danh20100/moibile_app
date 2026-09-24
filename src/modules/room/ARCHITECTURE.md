# Room Architecture

Status: Draft

## 1. Purpose

`room` đại diện cho đơn vị cho thuê cốt lõi và là operational anchor để các workflow khác tham chiếu.

Module này chịu trách nhiệm về room profile, room state và quan hệ giữa room với property.

## 2. Architectural Principle

Module tuân theo **Contract-first + persistence-agnostic business flows**.

Room phải giữ business identity và lifecycle riêng, không trở thành nơi gom toàn bộ state của tenancy, billing, incident hoặc listing.

Persistence chỉ lưu và phục hồi room state; database không định nghĩa room lifecycle.

## 3. Knowledge Boundary

Room chỉ cần biết property reference, room identity, room profile và room state hiện tại.

Module không cần biết đầy đủ tenant profile, billing debt, receipt history, incident detail hoặc listing public content.

Các module khác tham chiếu room thông qua reference và chỉ lấy context cần thiết cho flow của mình.

## 4. Business Flows

Các business flow chính gồm:

- tạo room trong một property;
- duy trì room profile;
- đưa room từ trạng thái chuẩn bị sang trạng thái sẵn sàng vận hành;
- chuyển room giữa vacant, occupied và maintenance theo business rule;
- archive room khi phù hợp;
- cung cấp room reference làm điểm neo cho tenancy, billing, incident và listing.

## 5. State & Invariants

Room lifecycle hiện tại gồm các trạng thái: Draft, Vacant, Occupied, Maintenance và Archived.

Các transition đã được xác định gồm:

- Draft sang Vacant;
- Vacant sang Occupied;
- Occupied sang Vacant;
- Vacant sang Maintenance;
- Occupied sang Maintenance;
- Maintenance sang Vacant;
- Vacant sang Archived.

Các invariant chính:

- room phải thuộc một property hợp lệ;
- room status độc lập với tenancy status;
- room status độc lập với billing debt;
- room status độc lập với incident status;
- room status độc lập với listing status;
- một workflow khác không được thay đổi room state bằng cách sửa internal state trực tiếp.

## 6. Public Boundary

Các module khác chỉ được tương tác với room thông qua capability công khai như:

- tạo hoặc đọc room;
- xác nhận room reference;
- đọc room state cần thiết cho business decision;
- yêu cầu một room state transition hợp lệ;
- đọc property relationship của room khi được phép.

Bên ngoài không được dùng room như container để lưu state thuộc module khác.

## 7. Cross-module Relationships

Room liên kết với:

- `property` để nhận property scope;
- `tenancy` để một kỳ thuê tham chiếu room;
- `billing` để billing gắn với room trong context phù hợp;
- `incident` để sự cố tham chiếu room;
- `listing` để public listing tham chiếu room;
- `audit-trust` để lưu các business fact quan trọng.

Room cung cấp reference và state context cần thiết nhưng không sở hữu lifecycle của các module liên quan.

## 8. Ownership

`room` sở hữu:

- room identity ở mức business;
- room profile cơ bản;
- room state;
- room lifecycle;
- quan hệ giữa room và property reference.

`room` không sở hữu:

- tenant assignment;
- tenancy lifecycle;
- billing cycle hoặc debt;
- receipt;
- incident lifecycle;
- listing public content;
- subscription entitlement.

## 9. Persistence Boundary

Room business flow không phụ thuộc database schema hoặc ORM model.

Persistence chỉ lưu và phục hồi room profile, property reference và room state.

Architecture phải cho phép thay persistence mechanism mà không làm thay đổi room transition rule hoặc room ownership boundary.

## 10. Events & Side Effects

Room có thể phát sinh business fact khi:

- room được tạo;
- room profile thay đổi;
- room chuyển trạng thái;
- room được archive;
- quan hệ với property thay đổi theo business rule.

Audit, notification, listing refresh hoặc analytics là side effect bên ngoài core room lifecycle.

## 11. Error & Testing View

Business errors tập trung vào domain room, ví dụ:

- room không tồn tại;
- property reference không hợp lệ;
- room transition không hợp lệ;
- action không được phép trong trạng thái hiện tại.

Testing tập trung vào behavior:

- room được tạo dưới đúng property;
- chỉ transition hợp lệ được chấp nhận;
- billing quá hạn không tự thay đổi room status;
- incident đang mở không tự thay đổi room status;
- listing state không được dùng thay room state;
- thay persistence mechanism không làm thay đổi behavior contract.

## 12. Evolution

Giai đoạn đầu tập trung vào room profile, property relationship và lifecycle cơ bản.

Giai đoạn tiếp theo các module tenancy, billing, incident và listing sử dụng room reference thông qua public boundary.

Sau đó có thể enrich operational metadata khi business thật sự cần, nhưng room vẫn chỉ là operational anchor chứ không trở thành aggregate của mọi workflow.
