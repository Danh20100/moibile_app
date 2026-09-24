# Subscription Architecture

Status: Draft

## 1. Purpose

`subscription` quản lý gói sử dụng TrọƠi ở mức organization và quyết định capability nào được phép sử dụng theo entitlement hiện tại.

Module này chịu trách nhiệm cho subscription lifecycle ở mức sản phẩm, plan reference, entitlement decision và usage/limit context khi business cần.

## 2. Architectural Principle

Module tuân theo **Contract-first + persistence-agnostic business flows**.

Subscription phải tập trung vào capability/entitlement thay vì rải business logic theo tên gói thương mại.

Pricing, payment gateway, database hoặc framework không được định nghĩa entitlement behavior của module.

## 3. Knowledge Boundary

Subscription chỉ cần organization reference, subscription context, plan/entitlement information đã được chốt và capability đang được yêu cầu.

Module không cần biết room internals, listing internals, onboarding internals hoặc tenant billing details.

Tên gói, pricing và entitlement set có thể thay đổi theo packaging; module không tự suy luận capability chưa được cấu hình hoặc chưa được business chốt.

## 4. Business Flows

Các business flow chính gồm:

- liên kết organization với subscription context;
- xác định plan/entitlement hiện hành;
- đánh giá một capability request;
- trả decision allow hoặc deny ở mức product entitlement;
- theo dõi usage/limit metadata khi business cần;
- thay đổi subscription context theo lifecycle sản phẩm khi scope được chốt.

Module feature vẫn tự sở hữu business logic của feature sau khi entitlement cho phép.

## 5. State & Invariants

README chưa định nghĩa state machine chi tiết cho subscription, vì vậy architecture không tự thêm tên state hoặc transition mới.

Các invariant chính:

- subscription phải gắn với organization reference hợp lệ;
- entitlement decision chỉ dựa trên subscription/plan context có thẩm quyền;
- entitlement không thay thế identity/access permission;
- entitlement không thay thế business rule của feature module;
- tenant billing và landlord-tenant receivable không thuộc subscription;
- pricing name hoặc plan label không được hard-code thành business capability nếu packaging chưa chốt.

## 6. Public Boundary

Các module khác chỉ được tương tác với subscription thông qua capability công khai như:

- đọc subscription context được phép;
- kiểm tra một capability có được entitlement hay không;
- đọc usage/limit context khi cần;
- yêu cầu thay đổi subscription lifecycle thông qua business flow đã được chốt.

Bên ngoài không được tự suy luận entitlement từ tên plan hoặc chỉnh trực tiếp internal subscription state.

## 7. Cross-module Relationships

Subscription liên kết với:

- `organization` để nhận organization reference;
- `identity-access` khi access context cần kết hợp với entitlement decision;
- các feature module như `room`, `listing`, `onboarding` khi feature cần entitlement check;
- `audit-trust` khi cần lưu business fact quan trọng về subscription hoặc entitlement change.

Subscription chỉ trả entitlement decision; feature module vẫn sở hữu business behavior của feature.

## 8. Ownership

`subscription` sở hữu:

- subscription context của organization;
- plan reference;
- entitlement set ở mức sản phẩm;
- capability decision;
- usage/limit metadata khi business cần;
- subscription lifecycle khi được chốt.

`subscription` không sở hữu:

- authentication;
- role/permission;
- room business logic;
- listing business logic;
- onboarding business logic;
- tenant billing;
- receipt;
- payment gateway;
- bank settlement.

## 9. Persistence Boundary

Subscription business flow không phụ thuộc database schema hoặc billing provider implementation.

Persistence chỉ lưu và phục hồi subscription context, entitlement information và usage/limit data cần thiết.

Việc thay persistence mechanism hoặc commercial packaging không được làm thay đổi nguyên tắc capability-based entitlement.

## 10. Events & Side Effects

Subscription có thể phát sinh business fact khi:

- subscription được tạo hoặc liên kết với organization;
- plan/entitlement context thay đổi;
- capability availability thay đổi;
- usage/limit context đạt một mốc business quan trọng;
- subscription lifecycle thay đổi theo rule đã được chốt.

Audit, notification, analytics hoặc billing-provider communication là side effect ngoài core entitlement responsibility.

## 11. Error & Testing View

Business errors tập trung vào domain subscription, ví dụ:

- subscription không tồn tại;
- organization reference không hợp lệ;
- capability không được entitlement;
- entitlement context không đủ để đưa ra decision;
- action không hợp lệ với subscription context hiện tại.

Testing tập trung vào behavior:

- entitlement decision dựa trên capability thay vì tên gói;
- subscription không thay identity/access permission;
- feature module vẫn tự kiểm soát business rule sau allow decision;
- tenant billing không đi vào subscription;
- thay persistence hoặc packaging không làm thay đổi behavior contract.

## 12. Evolution

Giai đoạn đầu chỉ cần organization-to-subscription relation và entitlement decision cơ bản.

Giai đoạn tiếp theo có thể bổ sung usage/limit metadata khi packaging cần.

Sau đó mới mở rộng lifecycle, commercial plan mapping hoặc provider integration khi business model được chốt.

Mọi mở rộng phải giữ subscription là capability/entitlement boundary thay vì trở thành nơi chứa business logic của từng feature.
