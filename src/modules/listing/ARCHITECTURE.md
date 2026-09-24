# Listing Architecture

Status: Draft

## 1. Purpose

`listing` quản lý cách một room được đưa ra bên ngoài để người thuê có thể tìm, xem và khám phá thông tin public.

Module này chịu trách nhiệm về public listing content, publish lifecycle và discovery/map boundary.

## 2. Architectural Principle

Module tuân theo **Contract-first + persistence-agnostic business flows**.

Listing là public projection của room và property context, không phải operational record của room.

Business flow của listing phải được xác định trước search engine, map SDK, geocoding provider, database hoặc framework cụ thể.

## 3. Knowledge Boundary

Listing chỉ cần room reference, property/location context, public content, publish state và availability context cần thiết.

Module không cần biết room operational history, tenancy lifecycle, billing, receipt, incident hoặc internal management data.

Public content chỉ được lấy từ nguồn có thẩm quyền và không được tự suy luận từ internal data không được publish.

## 4. Business Flows

Các business flow chính gồm:

- tạo listing draft từ room/property context;
- duy trì nội dung public;
- publish listing;
- hide listing;
- publish lại listing đã hidden;
- đánh dấu listing là rented khi business flow phù hợp;
- cung cấp dữ liệu cần thiết cho discovery và map presentation.

## 5. State & Invariants

Listing lifecycle hiện tại gồm Draft, Published, Hidden và Rented.

Các transition đã được xác định gồm:

- Draft sang Published;
- Published sang Hidden;
- Hidden sang Published;
- Published sang Rented.

Các invariant chính:

- listing phải tham chiếu room hợp lệ;
- public listing content tách khỏi room operational history;
- listing state độc lập với room state;
- property location có thể được dùng làm nguồn location nền nhưng listing vẫn sở hữu public presentation;
- listing không được chứa tenancy, billing hoặc incident state;
- discovery/map không được làm thay đổi ownership của listing.

## 6. Public Boundary

Các module khác chỉ được tương tác với listing thông qua capability công khai như:

- tạo hoặc đọc listing;
- duy trì public content;
- yêu cầu publish, hide hoặc rented transition hợp lệ;
- cung cấp listing data cho discovery/map;
- xác nhận room/property reference liên quan.

Bên ngoài không được chỉnh trực tiếp publish state hoặc internal listing representation.

## 7. Cross-module Relationships

Listing liên kết với:

- `property` để nhận location context nền;
- `room` để tham chiếu resource được publish và availability context cần thiết;
- `audit-trust` để lưu các business fact quan trọng.

Discovery/map tiêu thụ listing/location context nhưng không sở hữu room operational data.

## 8. Ownership

`listing` sở hữu:

- listing identity ở mức business;
- public listing content;
- media references ở mức listing;
- public price, deposit và fee presentation;
- publish lifecycle;
- discovery/map projection của listing;
- public location representation thuộc listing.

`listing` không sở hữu:

- room operational history;
- tenancy lifecycle;
- billing hoặc receipt;
- incident;
- service marketplace;
- map provider implementation;
- logic vận hành sau khi tenant vào ở.

## 9. Persistence Boundary

Listing business flow không phụ thuộc database schema, search index hoặc map storage implementation.

Persistence chỉ lưu và phục hồi listing content, state và references cần thiết.

Search indexing hoặc map indexing là infrastructure/side-effect concern và không được định nghĩa publish lifecycle.

## 10. Events & Side Effects

Listing có thể phát sinh business fact khi:

- listing được tạo;
- listing được publish;
- listing bị hidden;
- listing được publish lại;
- listing chuyển sang rented;
- public content hoặc public location thay đổi.

Search indexing, map refresh, analytics và notification là side effect bên ngoài core listing lifecycle.

## 11. Error & Testing View

Business errors tập trung vào domain listing, ví dụ:

- listing không tồn tại;
- room hoặc property context không hợp lệ;
- publish transition không hợp lệ;
- public data không đủ để thực hiện action được yêu cầu.

Testing tập trung vào behavior:

- listing chỉ đi qua lifecycle đã được xác định;
- public content tách khỏi room operational history;
- room state và listing state không bị đồng nhất;
- discovery/map chỉ nhận public/location context cần thiết;
- thay persistence hoặc search implementation không làm thay đổi behavior contract.

## 12. Evolution

Giai đoạn đầu tập trung vào listing content và publish lifecycle.

Giai đoạn tiếp theo bổ sung discovery và map presentation dựa trên property/location context.

Sau đó có thể enrich search, filtering hoặc availability projection khi product cần.

Mọi mở rộng phải giữ listing là public projection, không kéo room operations hoặc tenancy lifecycle vào module này.
