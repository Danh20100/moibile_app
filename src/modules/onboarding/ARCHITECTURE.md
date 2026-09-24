# Onboarding Architecture

Status: Draft

## 1. Purpose

`onboarding` điều phối quá trình đưa dữ liệu vận hành ban đầu vào TrọƠi theo cách nhanh, có kiểm soát và có bước xác nhận trước khi tạo dữ liệu thật.

Module này chịu trách nhiệm cho flow import/bulk input, validation, preview, confirmation và mapping sang các module đích.

## 2. Architectural Principle

Module tuân theo **Contract-first + persistence-agnostic business flows**.

Onboarding là orchestration boundary, không phải nơi sở hữu lâu dài property, room, tenancy hoặc billing data.

Business flow phải được xác định trước parser library, file storage, database, framework hoặc import infrastructure cụ thể.

## 3. Knowledge Boundary

Onboarding chỉ cần input data, validation result, preview representation, confirmation state và mapping context cần thiết để tạo dữ liệu vào module đích.

Module không cần biết internals của property, room, tenancy hoặc billing; nó chỉ cần public boundary cần thiết để gửi dữ liệu đã được xác nhận.

Nếu một field hoặc mapping chưa được business chốt, onboarding không tự invent dữ liệu để hoàn thiện import.

## 4. Business Flows

Flow chính gồm:

Import hoặc Bulk Input → Parse/Validate → Preview → Confirm → Create Domain Data.

Các flow hỗ trợ gồm:

- nhận template hoặc file import;
- parse dữ liệu đầu vào;
- validate theo rule đã được phép;
- hiển thị preview;
- nhận confirmation;
- mapping dữ liệu đã xác nhận sang module đích;
- ghi nhận kết quả import.

Không tạo dữ liệu domain thật trước bước confirm.

## 5. State & Invariants

README chưa chốt một state machine riêng cho onboarding, vì vậy architecture không tự thêm tên state mới.

Các invariant chính:

- dữ liệu phải được validate trước khi tạo domain data;
- phải có preview trước confirmation;
- phải có confirmation trước khi tạo dữ liệu thật;
- onboarding không giữ ownership của dữ liệu sau khi module đích chấp nhận;
- mapping không được bỏ qua business boundary của module đích;
- không tự invent transaction hoặc rollback semantics chưa được chốt.

## 6. Public Boundary

Các capability công khai của onboarding gồm:

- nhận import hoặc bulk input;
- validate dữ liệu;
- cung cấp preview;
- nhận confirmation;
- điều phối creation request sang module đích;
- trả kết quả import ở mức business.

Bên ngoài không được bỏ qua preview/confirm để ghi trực tiếp dữ liệu thông qua onboarding.

## 7. Cross-module Relationships

Onboarding liên kết với:

- `property` để tạo property data đã xác nhận;
- `room` để tạo room data đã xác nhận;
- `tenancy` để tạo tenancy data đã xác nhận;
- `billing` để tạo billing context đã xác nhận khi flow cho phép;
- `audit-trust` để lưu business fact quan trọng về import.

Sau khi dữ liệu được tạo thành công, ownership chuyển về module đích tương ứng.

## 8. Ownership

`onboarding` sở hữu:

- import/bulk-input flow;
- parse/validation orchestration;
- preview;
- confirmation boundary;
- mapping orchestration;
- import result ở mức onboarding.

`onboarding` không sở hữu:

- property lifecycle;
- room lifecycle;
- tenancy lifecycle;
- billing lifecycle;
- authentication;
- dữ liệu domain sau khi module đích đã tạo;
- AI/OCR production flow trong MVP hiện tại.

## 9. Persistence Boundary

Onboarding business flow không phụ thuộc database schema hoặc file-storage implementation.

Persistence tạm thời nếu có chỉ phục vụ giữ import context, preview hoặc confirmation cần thiết cho flow.

Domain persistence vẫn thuộc module đích; onboarding không trở thành database gateway chung cho toàn hệ thống.

## 10. Events & Side Effects

Onboarding có thể phát sinh business fact khi:

- import được nhận;
- validation hoàn tất;
- preview sẵn sàng;
- import được xác nhận;
- domain creation hoàn tất hoặc thất bại ở mức business;
- import flow kết thúc.

Audit, notification hoặc analytics là side effect bên ngoài core onboarding flow.

## 11. Error & Testing View

Business errors tập trung vào onboarding flow, ví dụ:

- input không hợp lệ;
- validation thất bại;
- mapping không hợp lệ;
- confirmation chưa tồn tại;
- module đích từ chối creation request.

Testing tập trung vào behavior:

- invalid input không đi tới create-domain-data;
- preview luôn có trước confirmation;
- không có confirmation thì không tạo dữ liệu thật;
- dữ liệu sau khi tạo thuộc module đích;
- thay parser hoặc persistence mechanism không làm thay đổi behavior contract.

## 12. Evolution

Giai đoạn đầu tập trung vào template, CSV/Excel import, validation, preview và confirm.

Giai đoạn tiếp theo có thể enrich mapping, import report và audit.

Sau đó mới cân nhắc automation bổ sung nếu có business evidence rõ ràng.

AI/OCR production flow không được giả định là một phần của architecture hiện tại cho tới khi scope được chốt riêng.
