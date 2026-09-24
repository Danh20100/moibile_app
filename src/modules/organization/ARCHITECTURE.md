# Organization Architecture

Status: Draft

## 1. Purpose

`organization` đại diện cho phạm vi vận hành cấp cao nhất của một chủ nhà, chủ trọ hoặc đơn vị quản lý trong TrọƠi.

Module này chịu trách nhiệm định hình một đơn vị vận hành chung để owner, operator và nhiều property có thể được liên kết trong cùng một phạm vi business.

## 2. Architectural Principle

Module tuân theo **Contract-first + persistence-agnostic business flows**.

Business flow của organization phải được xác định độc lập với database, ORM, transport, framework và subscription implementation cụ thể.

Organization là business scope; persistence chỉ lưu và phục hồi scope đó.

## 3. Knowledge Boundary

Organization chỉ cần biết những reference và trạng thái cần thiết để đại diện cho đơn vị vận hành.

Module không cần biết đầy đủ user profile, permission internals, property details, subscription pricing hoặc dữ liệu vận hành của room.

Khi một thông tin chưa có nguồn có thẩm quyền, organization không tự suy luận hoặc tạo placeholder.

## 4. Business Flows

Các business flow chính gồm:

- tạo một organization;
- duy trì thông tin cơ bản của organization;
- liên kết owner hoặc operator ở mức business reference;
- nhóm nhiều property dưới cùng một organization;
- thay đổi trạng thái hoạt động của organization khi business yêu cầu.

Organization cung cấp scope cho các flow phía sau nhưng không trực tiếp thực hiện business flow của property, room, tenancy hoặc billing.

## 5. State & Invariants

Các invariant chính:

- một organization là một business scope độc lập;
- property thuộc organization thông qua quan hệ rõ ràng, không suy ra ngầm từ user hoặc room;
- owner/operator reference không đồng nghĩa với permission; quyền truy cập vẫn thuộc `identity-access`;
- organization state không được dùng thay cho property, room hoặc subscription state;
- lifecycle chi tiết ngoài trạng thái hoạt động cơ bản chưa được chốt thì không được tự bổ sung.

## 6. Public Boundary

Các module khác chỉ được tương tác với organization thông qua business capability công khai như:

- tạo hoặc đọc organization;
- xác nhận organization reference;
- đọc phạm vi organization cần thiết cho flow khác;
- gắn hoặc bỏ liên kết business reference đã được cho phép;
- kiểm tra trạng thái organization khi business flow cần.

Bên ngoài không được truy cập trực tiếp internal representation để tự thay đổi scope hoặc membership.

## 7. Cross-module Relationships

Organization liên kết với:

- `identity-access` để nhận identity và access decision;
- `property` để nhóm tài sản thuộc cùng đơn vị vận hành;
- `subscription` để nhận entitlement decision của organization;
- `audit-trust` để lưu các business fact quan trọng.

Quan hệ này không làm thay đổi ownership của từng module.

## 8. Ownership

`organization` sở hữu:

- organization identity ở mức business;
- organization profile cơ bản;
- organization operating scope;
- quan hệ business giữa organization và owner/operator reference;
- quan hệ grouping giữa organization và property reference.

`organization` không sở hữu:

- authentication;
- permission implementation;
- user profile đầy đủ;
- property details;
- room lifecycle;
- tenancy;
- billing hoặc receipt;
- incident;
- subscription pricing hoặc payment logic.

## 9. Persistence Boundary

Organization business flow không phụ thuộc vào cách dữ liệu được lưu.

Persistence chỉ chịu trách nhiệm lưu và phục hồi organization, trạng thái hoạt động và các reference cần thiết.

Architecture phải cho phép thay persistence mechanism mà không làm thay đổi organization scope hoặc các invariant của module.

## 10. Events & Side Effects

Organization có thể phát sinh các business fact như:

- organization được tạo;
- organization profile thay đổi;
- owner/operator reference được liên kết hoặc gỡ liên kết;
- property reference được thêm hoặc loại khỏi organization;
- trạng thái organization thay đổi.

Audit, notification, analytics hoặc entitlement recalculation là side effect của module nhận business fact tương ứng, không phải core responsibility của organization.

## 11. Error & Testing View

Business errors tập trung vào domain organization, ví dụ:

- organization không tồn tại;
- organization reference không hợp lệ;
- quan hệ business được yêu cầu không hợp lệ;
- action không được phép trong trạng thái hiện tại.

Testing tập trung vào behavior và boundary:

- organization được tạo trong phạm vi hợp lệ;
- property grouping không làm thay đổi ownership của property;
- owner/operator reference không tự tạo permission;
- entitlement decision vẫn thuộc subscription;
- thay persistence mechanism không làm thay đổi behavior contract.

## 12. Evolution

Giai đoạn đầu chỉ cần organization identity, profile cơ bản và grouping scope.

Giai đoạn tiếp theo bổ sung liên kết owner/operator rõ hơn thông qua identity context.

Sau đó organization có thể nhận entitlement decision từ subscription và mở rộng multi-property operation khi product cần.

Mỗi giai đoạn bổ sung context quanh organization scope mà không biến organization thành nơi chứa business logic của các module con.
