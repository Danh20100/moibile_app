# Property Architecture

Status: Draft

## 1. Purpose

`property` đại diện cho một tài sản hoặc khu trọ ở cấp địa điểm trong TrọƠi.

Module này chịu trách nhiệm quản lý property profile, location nền và quan hệ grouping giữa property với các room thuộc cùng tài sản.

## 2. Architectural Principle

Module tuân theo **Contract-first + persistence-agnostic business flows**.

Business flow của property được xác định trước database, geocoding provider, map provider, framework hoặc transport cụ thể.

Property là nguồn business context về tài sản và vị trí; infrastructure chỉ hỗ trợ lưu, phục hồi hoặc enrich dữ liệu đó.

## 3. Knowledge Boundary

Property chỉ cần biết thông tin ở cấp tài sản như organization reference, property identity, profile cơ bản, location và các room reference liên quan.

Module không cần biết room operational history, tenancy, billing, receipt, incident hoặc public listing content.

Property cũng không cần biết cách map hoặc geocoding provider biểu diễn location.

## 4. Business Flows

Các business flow chính gồm:

- tạo property trong một organization scope;
- duy trì property profile;
- duy trì location nền của property;
- nhóm các room thuộc cùng property;
- thay đổi trạng thái tồn tại của property khi business yêu cầu.

Location của property có thể được module khác sử dụng nhưng property không trực tiếp điều khiển discovery hoặc map rendering.

## 5. State & Invariants

Các invariant chính:

- property phải thuộc một organization scope hợp lệ;
- room grouping không làm property sở hữu room lifecycle;
- property state độc lập với trạng thái của từng room;
- location của property là dữ liệu nền, không đồng nghĩa với public listing location presentation;
- listing, tenancy, billing, receipt và incident không được gộp vào property state;
- lifecycle chi tiết ngoài trạng thái active/archive ở mức business chưa được chốt thì không được tự bổ sung.

## 6. Public Boundary

Các module khác chỉ được tương tác với property thông qua các capability công khai như:

- tạo hoặc đọc property;
- xác nhận property reference;
- đọc profile hoặc location được phép công khai cho business flow khác;
- xác nhận quan hệ property với organization;
- quản lý grouping room reference ở mức được cho phép.

Bên ngoài không được chỉnh sửa trực tiếp internal state của property.

## 7. Cross-module Relationships

Property liên kết với:

- `organization` để nhận organization scope;
- `room` để quản lý grouping của các room thuộc property;
- `listing` để cung cấp location nền khi listing cần;
- `audit-trust` để lưu business fact quan trọng.

Listing có thể sử dụng location từ property nhưng public listing content vẫn thuộc listing.

## 8. Ownership

`property` sở hữu:

- property identity ở mức business;
- property profile;
- address/location nền;
- trạng thái tồn tại của property;
- quan hệ grouping giữa property và room reference.

`property` không sở hữu:

- room lifecycle;
- tenancy;
- billing hoặc receipt;
- incident;
- public listing content;
- map rendering;
- geocoding implementation.

## 9. Persistence Boundary

Property business flow không phụ thuộc database schema hoặc storage engine.

Persistence chỉ lưu và phục hồi property profile, location, trạng thái và references cần thiết.

Việc thay persistence mechanism hoặc location storage representation không được làm thay đổi business ownership của property.

## 10. Events & Side Effects

Property có thể phát sinh business fact khi:

- property được tạo;
- property profile thay đổi;
- location thay đổi;
- room reference được thêm hoặc loại khỏi grouping;
- property status thay đổi.

Audit, search indexing, map refresh hoặc analytics là side effect bên ngoài core responsibility của property.

## 11. Error & Testing View

Business errors tập trung vào domain property, ví dụ:

- property không tồn tại;
- organization reference không hợp lệ;
- property reference không hợp lệ;
- room grouping không hợp lệ;
- action không hợp lệ với trạng thái property hiện tại.

Testing tập trung vào behavior:

- property được tạo trong đúng organization scope;
- location được duy trì mà không kéo map provider vào core;
- room grouping không làm property sở hữu room state;
- listing chỉ nhận location context cần thiết;
- thay persistence mechanism không làm thay đổi behavior contract.

## 12. Evolution

Giai đoạn đầu cần property profile, location và grouping room cơ bản.

Giai đoạn tiếp theo có thể enrich location và validation khi nguồn dữ liệu phù hợp tồn tại.

Sau đó listing và map/discovery có thể tiêu thụ location thông qua public boundary.

Mỗi bước mở rộng phải giữ property là nguồn dữ liệu cấp tài sản, không biến module này thành listing hoặc room operations module.
