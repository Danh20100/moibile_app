# Module Architecture Contract-First Design

Status: Approved draft

## Mục tiêu

Chuẩn hóa cách thiết kế kiến trúc cho từng module backend của TrọƠi trước khi triển khai chi tiết.

Mỗi module phải có một tài liệu `ARCHITECTURE.md` mô tả business flow, boundary, dependency, ownership và cách module tiến hóa theo thời gian.

Tài liệu kiến trúc không dùng để mô tả implementation cụ thể.

## Nguyên tắc trung tâm

Toàn bộ module backend đi theo hướng **Contract-first + persistence-agnostic business flows**.

Business flow và business rule được xác định trước database, ORM, framework, provider hoặc transport cụ thể.

Database bổ sung dữ liệu cho business flow nhưng không định nghĩa business flow.

Module khác có thể biết contract công khai của nhau nhưng không được biết internal implementation của nhau.

## Quy tắc về mức độ hiểu biết

Mỗi module chỉ được biết đúng lượng thông tin cần thiết để thực hiện trách nhiệm của nó.

Nếu một thông tin chưa có nguồn dữ liệu đáng tin cậy thì module không được tự tạo placeholder hoặc giả định giá trị.

Thông tin chi tiết được bổ sung dần thông qua các module hoặc persistence layer có thẩm quyền.

## Quy tắc giao tiếp giữa module

Các module ưu tiên giao tiếp bằng ba loại thông tin:

- reference: tham chiếu đến entity thuộc module khác;
- decision: kết quả nghiệp vụ do module có thẩm quyền trả về;
- event: thông báo rằng một business fact đã xảy ra.

Một module không được đọc trực tiếp internal state của module khác để tự suy luận business rule thuộc ownership của module đó.

## Quy tắc persistence

Business logic không được thiết kế dựa trên table, collection, ORM model hoặc database engine cụ thể.

Persistence chỉ chịu trách nhiệm lưu, tìm và phục hồi dữ liệu cần thiết cho business flow.

Architecture phải cho phép đi từ không có persistence, sang persistence tạm thời, rồi sang database thật mà không phải viết lại core business flow.

## Quy tắc integration

Provider hoặc SDK bên ngoài thuộc integration boundary.

Dữ liệu provider-specific phải được chuẩn hóa trước khi đi vào module business.

Business module không phụ thuộc trực tiếp vào SDK, network implementation hoặc error format của provider.

## Quy tắc tài liệu

Mỗi `ARCHITECTURE.md` phải trả lời các góc nhìn sau:

1. Purpose
2. Architectural Principle
3. Knowledge Boundary
4. Business Flows
5. State & Invariants
6. Public Boundary
7. Cross-module Relationships
8. Ownership
9. Persistence Boundary
10. Events & Side Effects
11. Error & Testing View
12. Evolution

Không bắt buộc mọi module phải có state machine hoặc event nếu business của module không cần chúng, nhưng tài liệu phải nói rõ phần đó có áp dụng hay không.

## Điều cấm trong ARCHITECTURE.md

Không viết source code.

Không viết interface, DTO, class, function signature hoặc pseudo-code.

Không viết database schema, table definition hoặc ORM model.

Không viết framework syntax.

Không mô tả implementation provider-specific trừ khi chỉ để xác định rõ boundary và phần nào không thuộc module.

Không thêm field hoặc dữ liệu giả chỉ để tài liệu trông đầy đủ.

## Quan hệ với README

`README.md` mô tả module làm gì ở góc nhìn sản phẩm và business responsibility.

`ARCHITECTURE.md` mô tả module phải được xây dựng theo boundary và flow nào.

Hai file bổ sung cho nhau và không thay thế nhau.

## Hai module dùng làm chuẩn đầu tiên

Hai draft đầu tiên là:

- `identity-access`: đại diện cho module có integration boundary mạnh và knowledge enrichment theo từng giai đoạn;
- `incident`: đại diện cho module có lifecycle, invariant và cross-module interaction rõ ràng.

Sau khi hai draft này được review và ổn định, cùng template sẽ được áp dụng cho các module backend còn lại.
