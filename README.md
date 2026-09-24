# TrọƠi

TrọƠi là **sổ vận hành thuê trọ theo từng phòng/tài sản** dành cho chủ nhà, chủ trọ và người vận hành. Lõi sản phẩm nằm ở giai đoạn sau khi phòng được đưa vào vận hành: ghi nhận người thuê ở mức cần thiết, giá thuê, tiền cọc, phụ phí, công nợ, biên nhận hoặc bản ghi thanh toán, sự cố và lịch sử xử lý. TrọƠi không được định vị chủ yếu như một ứng dụng tìm phòng hay marketplace.

## Product Orientation

- **Core:** hồ sơ vận hành theo phòng/tài sản và các workflow sau thuê.
- **Primary payer:** chủ nhà, chủ trọ hoặc bên chịu chi phí vận hành.
- **Operator:** người trực tiếp vận hành hằng ngày; có thể là chủ trọ, người thân, quản lý khu trọ hoặc nhân viên vận hành.
- **Tenant user:** người thuê tham gia xem thông tin được phép, đối chiếu biên nhận và báo sự cố; không phải nguồn thu chính của MVP.
- **Future layer:** mạng lưới đối tác dịch vụ vận hành có kiểm soát ở Phase 2 trở đi.

Listing, discovery và map có thể tồn tại như bề mặt hỗ trợ cho hành trình thuê, nhưng **không phải lõi định vị của TrọƠi**.

## Backend Documentation Model

Tài liệu backend được chia thành hai tầng:

1. **Project-level context** giải thích TrọƠi là gì, use case nào quan trọng và các bounded context phối hợp ra sao.
2. **Module-level documentation** giải thích ownership, lifecycle, invariant và boundary của từng module.

Một implementation chỉ được xem là phù hợp khi đúng cả hai tầng.

## Reading Order for Humans and Agents

Đọc theo thứ tự sau trước khi sửa hoặc thêm implementation:

1. `README.md`
2. [`docs/PROJECT_CONTEXT.md`](docs/PROJECT_CONTEXT.md)
3. [`docs/USE_CASES.md`](docs/USE_CASES.md)
4. [`docs/SYSTEM_CONTEXT.md`](docs/SYSTEM_CONTEXT.md)
5. `src/modules/<target-module>/README.md`
6. `src/modules/<target-module>/ARCHITECTURE.md`
7. tài liệu của các module liên quan trong use case đang triển khai
8. implementation hiện có

Các module hiện tại nằm trong [`src/modules/`](src/modules/).

## Current Backend Direction

Backend ưu tiên **Contract-first + persistence-agnostic business flows**: business flow, ownership và boundary được xác định trước persistence hoặc infrastructure cụ thể. Dữ liệu chưa có nguồn có thẩm quyền thì vẫn được coi là chưa biết; không tạo placeholder chỉ để làm flow trông hoàn chỉnh.
