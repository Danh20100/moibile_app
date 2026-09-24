# Identity & Access Architecture

Status: Draft

## 1. Purpose

`identity-access` chịu trách nhiệm về danh tính và quyền truy cập trong hệ thống TrọƠi.

Module này trả lời các câu hỏi:

- một yêu cầu đến từ identity nào;
- identity đó đã được xác thực hay chưa;
- identity đó có liên kết với user nội bộ hay chưa;
- user có quyền thực hiện một hành động trong một phạm vi cụ thể hay không;
- lời mời và quyền truy cập thay đổi trạng thái như thế nào.

Module này không chịu trách nhiệm xây dựng profile hoàn chỉnh của người dùng.

## 2. Architectural Principle

Module tuân theo **Contract-first + persistence-agnostic business flows**.

Business flow được xác định trước database, ORM, profile schema, session implementation, token strategy và provider-specific authentication.

Identity được xác thực trước. Thông tin chi tiết về identity chỉ được bổ sung khi hệ thống có nguồn dữ liệu đáng tin cậy để cung cấp.

## 3. Knowledge Boundary

Ở bước authentication đầu tiên, hệ thống chỉ cần biết rằng identity đã được xác minh và được chấp nhận.

Ở bước này hệ thống chưa cần biết:

- tên người dùng;
- avatar;
- số điện thoại;
- tenant profile;
- landlord profile;
- organization;
- property;
- room;
- subscription;
- lịch sử hoạt động.

Không tạo dữ liệu placeholder để lấp chỗ trống.

Nếu hệ thống chưa biết một thông tin thì architecture phải giữ nguyên trạng thái chưa biết đó cho đến khi một nguồn dữ liệu có thẩm quyền cung cấp.

## 4. Business Flows

Flow authentication tối thiểu là:

Identity proof → Verification → Accepted identity.

Sau khi identity được chấp nhận, người dùng có thể đi tiếp vào hệ thống ở mức authentication.

User profile, organization, role và access scope là các bước enrichment riêng.

Flow có thể được mở rộng dần theo hướng:

Identity verified → User lookup → Membership lookup → Role → Scope → Permission.

Các bước enrichment được bổ sung mà không làm thay đổi bản chất của authentication.

## 5. State & Invariants

Các invariant chính:

- identity chưa được xác minh không được xem là authenticated;
- authentication không phụ thuộc vào việc profile đã tồn tại hay chưa;
- access decision chỉ được đưa ra khi có đủ context cần thiết;
- invitation chỉ được chuyển giữa các trạng thái hợp lệ;
- role và scope không được suy ra từ dữ liệu không thuộc ownership của module;
- provider-specific identity không được rò trực tiếp vào business contract nếu chưa được chuẩn hóa.

## 6. Public Boundary

`identity-access` nhận identity đã được chuẩn hóa từ integration boundary.

Module khác chỉ được tương tác với `identity-access` thông qua các business capability công khai như:

- xác nhận identity;
- kiểm tra actor có tồn tại trong identity context hay không;
- đánh giá quyền truy cập;
- quản lý invitation;
- quản lý role và scope khi dữ liệu đó đã tồn tại.

Module khác không được truy cập internal representation của identity, role, permission hoặc invitation.

## 7. Cross-module Relationships

`identity-access` có thể liên kết với:

- `organization`;
- `property`;
- `room`;
- `tenancy`;
- `audit-trust`.

Quan hệ này không làm thay đổi ownership.

`identity-access` có thể xác nhận một actor có quyền truy cập một property, nhưng property data vẫn thuộc `property`.

`identity-access` có thể xác nhận một tenant có quyền truy cập một tenancy, nhưng tenancy lifecycle vẫn thuộc `tenancy`.

External identity provider đi qua `integrations` trước khi đi vào `identity-access`.

## 8. Ownership

`identity-access` sở hữu:

- identity boundary;
- account access state;
- role assignment;
- access scope;
- permission decision;
- invitation lifecycle.

`identity-access` không sở hữu:

- user profile presentation;
- property data;
- room data;
- tenancy lifecycle;
- billing;
- receipt;
- incident;
- subscription;
- provider SDK;
- database schema.

## 9. Persistence Boundary

Business flow không được thiết kế dựa trên database schema.

Persistence chỉ là nơi lưu và truy xuất thông tin mà business flow cần.

Architecture phải cho phép hệ thống đi qua các giai đoạn:

No persistence → temporary persistence → database persistence.

Việc thay đổi persistence mechanism không được làm thay đổi business rule của authentication, invitation hoặc access evaluation.

## 10. Events & Side Effects

`identity-access` có thể phát sinh business facts như:

- identity được chấp nhận;
- user được liên kết với identity;
- invitation được tạo;
- invitation được chấp nhận;
- access được cấp;
- access bị thu hồi.

Các side effect như audit, notification hoặc analytics không thuộc core responsibility của `identity-access`.

Module nhận event tự chịu trách nhiệm xử lý side effect của mình.

## 11. Error & Testing View

Business layer chỉ quan tâm đến lỗi có ý nghĩa nghiệp vụ như:

- identity không hợp lệ;
- identity không được chấp nhận;
- access bị từ chối;
- invitation không hợp lệ;
- invitation transition không hợp lệ.

Lỗi của provider, database, network hoặc framework phải được chuyển đổi trước khi đi vào business layer.

Testing tập trung vào behavior:

- identity hợp lệ được chấp nhận;
- identity không hợp lệ bị từ chối;
- identity được chấp nhận ngay cả khi chưa có profile;
- access chỉ được quyết định khi có đủ context;
- invitation chỉ chuyển giữa các trạng thái hợp lệ;
- thay persistence mechanism không làm thay đổi behavior contract.

## 12. Evolution

Giai đoạn đầu chỉ cần xác minh identity và trả về identity đã được chấp nhận.

Giai đoạn tiếp theo liên kết identity với user nội bộ.

Sau đó bổ sung membership, role và scope.

Cuối cùng mới mở rộng thành fine-grained authorization khi domain data đã đủ rõ.

Mỗi giai đoạn bổ sung kiến thức mới nhưng không phá flow authentication ban đầu.
